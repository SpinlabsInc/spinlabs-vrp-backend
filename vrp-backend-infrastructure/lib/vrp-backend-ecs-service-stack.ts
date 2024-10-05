import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as iam from 'aws-cdk-lib/aws-iam';

interface EcsServiceStackProps extends cdk.StackProps {
  cluster: ecs.ICluster;
  repository: ecr.IRepository;
  vrpDataTable: dynamodb.Table;
  vrpSolutionsBucket: s3.Bucket;
  vpc: ec2.IVpc;
}

export class VRPBackendEcsServiceStack extends cdk.Stack {
  public readonly fargateService: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly batchJobDefinition: batch.CfnJobDefinition;
  public readonly batchJobQueue: batch.CfnJobQueue;

  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);

    // Create ECS Task Execution Role (to pull images from ECR and send logs to CloudWatch)
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),  // Add S3 or other policies as needed
      ],
    });

    // Create ECS Task Role (for accessing AWS resources like DynamoDB, S3, etc.)
    const taskRole = new iam.Role(this, 'EcsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant necessary permissions to task role
    props.vrpDataTable.grantReadWriteData(taskRole); // DynamoDB permissions
    props.vrpSolutionsBucket.grantReadWrite(taskRole); // S3 permissions

    // Create ECS Fargate Service with Application Load Balancer
    const loadBalancedFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'VRPBackendFargateService', {
      cluster: props.cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(props.repository, 'latest'), // Replace placeholder image with ECR repository image
        containerName: 'vrp-backend-container',
        containerPort: 80,
        environment: {
          VRP_DATA_TABLE: props.vrpDataTable.tableName,
          VRP_SOLUTIONS_BUCKET: props.vrpSolutionsBucket.bucketName,
          VRP_SOLVER_JOB_DEFINITION: 'solver-job-definition',
          VRP_SOLVER_JOB_QUEUE: 'solver-job-queue',
        },
        executionRole: executionRole, // Assign the execution role
        taskRole: taskRole, // Assign the task role
      },
      publicLoadBalancer: true,
    });

    // Configure health check
    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/api/health",
      healthyHttpCodes: "200-399",
    });

    // Set up auto scaling
    const scaling = loadBalancedFargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 2,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Create a CloudWatch alarm for HTTP 5xx errors
    new cloudwatch.Alarm(this, 'Http5xxAlarm', {
      metric: loadBalancedFargateService.loadBalancer.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'HTTP 5xx errors > 10',
    });

  
// Create the service role for the Batch Compute Environment
  const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
    assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
    // Add more policies if your job needs access to other AWS services
    ],
  });

    

    // Define a new Security Group for the Batch Compute Environment
    const securityGroup = new ec2.SecurityGroup(this, 'SolverSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      securityGroupName: 'solver-security-group',
      description: 'Security group for Solver Compute Environment',
    });

    // Create AWS Batch Compute Environment
    const batchComputeEnvironment = new batch.CfnComputeEnvironment(this, 'SolverComputeEnvironment', {
      computeEnvironmentName: 'solver-compute-environment-dev',
      type: 'MANAGED',
      computeResources: {
        type: 'FARGATE', // Use Fargate as the compute resource
        maxvCpus: 4,
        securityGroupIds: [securityGroup.securityGroupId], // Use the security group
        subnets: props.vpc.publicSubnets.map(subnet => subnet.subnetId),
      },
      serviceRole: batchServiceRole.roleArn, // Batch needs a role
      state: 'ENABLED',
    });

    // AWS Batch Job Definition
    this.batchJobDefinition = new batch.CfnJobDefinition(this, 'SolverJobDefinition', {
      type: 'container',
      containerProperties: {
        image: props.repository.repositoryUri,
        vcpus: 1,
        memory: 1024,
        environment: [
          { name: 'VRP_DATA_TABLE', value: props.vrpDataTable.tableName },
          { name: 'VRP_SOLUTIONS_BUCKET', value: props.vrpSolutionsBucket.bucketName },
        ],
      },
      jobDefinitionName: 'solver-job-definition',
    });

    // AWS Batch Job Queue
    this.batchJobQueue = new batch.CfnJobQueue(this, 'SolverJobQueue', {
      computeEnvironmentOrder: [
        {
          order: 1,
          computeEnvironment: batchComputeEnvironment.ref, // Ensure reference to compute environment
        },
      ],
      priority: 1,
      jobQueueName: 'solver-job-queue',
    });

    // Ensure Job Queue is created after the Compute Environment
    this.batchJobQueue.node.addDependency(batchComputeEnvironment);

    this.fargateService = loadBalancedFargateService.service;
    this.loadBalancer = loadBalancedFargateService.loadBalancer;

    // Outputs
    new cdk.CfnOutput(this, "VRPBackendEcsServiceName", {
      value: loadBalancedFargateService.service.serviceName,
      description: "VRPBackend ECS Service Name",
    });

    new cdk.CfnOutput(this, "VRPBackendLoadBalancerDNS", {
      value: this.loadBalancer.loadBalancerDnsName,
      description: "VRPBackend Load Balancer DNS Name",
    });
  }
}
