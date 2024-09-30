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

  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);

    // Create ECS Task Execution Role (to pull images from ECR and send logs to CloudWatch)
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
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
        image: ecs.ContainerImage.fromEcrRepository(props.repository), // Replace placeholder image with ECR repository image
        containerName: 'vrp-backend-container',
        containerPort: 80,
        environment: {
          VRP_DATA_TABLE: props.vrpDataTable.tableName,
          VRP_SOLUTIONS_BUCKET: props.vrpSolutionsBucket.bucketName,
        },
        executionRole: executionRole, // Assign the execution role
        taskRole: taskRole, // Assign the task role
      },
      publicLoadBalancer: true,
    });

    // Configure health check
    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/",
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

// import * as cdk from 'aws-cdk-lib';
// import * as ecs from 'aws-cdk-lib/aws-ecs';
// import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
// import * as ecr from 'aws-cdk-lib/aws-ecr';
// import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// import * as ec2 from 'aws-cdk-lib/aws-ec2';
// import { Construct } from 'constructs';
// import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

// interface EcsServiceStackProps extends cdk.StackProps {
//   cluster: ecs.ICluster;
//   repository: ecr.IRepository;
//   vrpDataTable: dynamodb.Table;
//   vrpSolutionsBucket: s3.Bucket;
//   vpc: ec2.IVpc;
// }

// export class VRPBackendEcsServiceStack extends cdk.Stack {
//   public readonly fargateService: ecs.FargateService;
//   public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

//   constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
//     super(scope, id, props);

//     const placeholderImage = ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:latest');

//     // Create ECS Fargate Service with Application Load Balancer
//     const loadBalancedFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'VRPBackendFargateService', {
//       cluster: props.cluster,
//       cpu: 256,
//       memoryLimitMiB: 512,
//       desiredCount: 1,
//       taskImageOptions: {
//         image: placeholderImage,
//         containerName: 'vrp-backend-container',
//         containerPort: 80,
//         environment: {
//           VRP_DATA_TABLE: props.vrpDataTable.tableName,
//           VRP_SOLUTIONS_BUCKET: props.vrpSolutionsBucket.bucketName,
//         },
//       },
//       publicLoadBalancer: false, // ALB in private subnet
//     });

//     // Grant permissions to the ECS task
//     props.vrpDataTable.grantReadWriteData(loadBalancedFargateService.taskDefinition.taskRole);
//     props.vrpSolutionsBucket.grantReadWrite(loadBalancedFargateService.taskDefinition.taskRole);

//     // Configure health check for ALB
//     loadBalancedFargateService.targetGroup.configureHealthCheck({
//       path: "/",
//       healthyHttpCodes: "200-399",
//       interval: cdk.Duration.seconds(60),
//       timeout: cdk.Duration.seconds(10),
//     });

//     // Set up auto scaling for Fargate service
//     const scaling = loadBalancedFargateService.service.autoScaleTaskCount({
//       minCapacity: 1,
//       maxCapacity: 2,
//     });

//     scaling.scaleOnCpuUtilization('CpuScaling', {
//       targetUtilizationPercent: 70,
//       scaleInCooldown: cdk.Duration.seconds(60),
//       scaleOutCooldown: cdk.Duration.seconds(60),
//     });

//     // Create a CloudWatch alarm for HTTP 5xx errors
//     new cloudwatch.Alarm(this, 'Http5xxAlarm', {
//       metric: loadBalancedFargateService.loadBalancer.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
//       threshold: 10,
//       evaluationPeriods: 1,
//       alarmDescription: 'HTTP 5xx errors > 10',
//     });

//     this.fargateService = loadBalancedFargateService.service;
//     this.loadBalancer = loadBalancedFargateService.loadBalancer;

//     // Outputs
//     new cdk.CfnOutput(this, "VRPBackendEcsServiceName", {
//       value: loadBalancedFargateService.service.serviceName,
//       description: "VRPBackend ECS Service Name",
//     });

//     new cdk.CfnOutput(this, "VRPBackendLoadBalancerDNS", {
//       value: this.loadBalancer.loadBalancerDnsName,
//       description: "VRPBackend Load Balancer DNS Name",
//     });
//   }
// }
