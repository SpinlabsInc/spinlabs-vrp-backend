// import * as cdk from 'aws-cdk-lib';
// import * as ecs from 'aws-cdk-lib/aws-ecs';
// import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
// import * as ecr from 'aws-cdk-lib/aws-ecr';
// import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// import * as batch from 'aws-cdk-lib/aws-batch';
// import * as iam from 'aws-cdk-lib/aws-iam';
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
//     const placeholderImage = ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest');


//     // Create ECS Fargate Service
//     const loadBalancedFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'VRPBackendFargateService', {
//       cluster: props.cluster,
//       cpu: 256,
//       memoryLimitMiB: 512,
//       desiredCount: 2,
//       taskImageOptions: {
//         image: placeholderImage, // Use placeholder image
//         containerName: 'vrp-backend-container',
//         containerPort: 80,
//         environment: {
//           VRP_DATA_TABLE: props.vrpDataTable.tableName,
//           VRP_SOLUTIONS_BUCKET: props.vrpSolutionsBucket.bucketName,
//         },
//       },
//       publicLoadBalancer: true,
//     });

//     // Grant permissions to the ECS task
//     props.vrpDataTable.grantReadWriteData(loadBalancedFargateService.taskDefinition.taskRole);
//     props.vrpSolutionsBucket.grantReadWrite(loadBalancedFargateService.taskDefinition.taskRole);

//     // Configure health check
//     loadBalancedFargateService.targetGroup.configureHealthCheck({
//       path: "/",
//       port: "80",
//       interval: cdk.Duration.seconds(30),
//       healthyHttpCodes: "200",
//     });

//     // Set up auto scaling
//     const scaling = loadBalancedFargateService.service.autoScaleTaskCount({
//       minCapacity: 1,
//       maxCapacity: 2,
//     });

//     scaling.scaleOnCpuUtilization('CpuScaling', {
//       targetUtilizationPercent: 70,
//       scaleInCooldown: cdk.Duration.seconds(60),
//       scaleOutCooldown: cdk.Duration.seconds(60),
//     });

//     scaling.scaleOnMemoryUtilization('MemoryScaling', {
//       targetUtilizationPercent: 50,
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

//     // Create AWS Batch Job Definition
//     const batchJobRole = new iam.Role(this, 'BatchJobRole', {
//       assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
//     });
//     batchJobRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'));

//     props.vrpDataTable.grantReadWriteData(batchJobRole);
//     props.vrpSolutionsBucket.grantReadWrite(batchJobRole);


//   const jobDefinition = new batch.CfnJobDefinition(this, 'VRPSolverJobDefinition', {
//   type: 'container',
//   containerProperties: {
//     image: 'public.ecr.aws/amazonlinux/amazonlinux:latest', // Use the full image URI
//     command: ['echo', 'This is a placeholder command'],
//     memory: 2048,
//     vcpus: 1,
//     environment: [
//       { name: 'VRP_DATA_TABLE', value: props.vrpDataTable.tableName },
//       { name: 'VRP_SOLUTIONS_BUCKET', value: props.vrpSolutionsBucket.bucketName },
//     ],
//     jobRoleArn: batchJobRole.roleArn,
//     executionRoleArn: batchJobRole.roleArn,
//     logConfiguration: {
//       logDriver: 'awslogs',
//       options: {
//         'awslogs-group': '/aws/batch/vrp-solver',
//         'awslogs-region': this.region,
//         'awslogs-stream-prefix': 'vrp-solver'
//       }
//     }
//   },
//   retryStrategy: {
//     attempts: 2,
//   },
//   timeout: {
//     attemptDurationSeconds: 3600,
//   },
// });
// // Create a security group for the Batch compute environment
//   const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchComputeEnvironmentSG', {
//   vpc: props.vpc,
//   description: 'Security Group for Batch Compute Environment',
//   allowAllOutbound: true,
//   });

// // If your VRP solver needs any specific inbound rules, add them here
// // For example, if it needs to accept incoming connections on a specific port:
// // batchSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), 'Allow inbound on port 8080');
//     // Create Batch Compute Environment using CfnComputeEnvironment
//     const computeEnvironment = new batch.CfnComputeEnvironment(this, 'VRPSolverComputeEnv', {
//       type: 'MANAGED',
//       computeResources: {
//         type: 'EC2',
//         minvCpus: 0,
//         maxvCpus: 10,
//         desiredvCpus: 0,
//         instanceTypes: ['optimal'],
//         subnets: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
//         securityGroupIds: [batchSecurityGroup.securityGroupId],
//         instanceRole: new iam.CfnInstanceProfile(this, 'BatchInstanceProfile', {
//           roles: [batchJobRole.roleName]
//         }).attrArn,
//       },
//       serviceRole: batchJobRole.roleArn,
//     });
//     // Create Batch Job Queue
//     const jobQueue = new batch.CfnJobQueue(this, 'VRPSolverJobQueue', {
//       computeEnvironmentOrder: [
//         {
//           computeEnvironment: computeEnvironment.ref,
//           order: 1,
//         },
//       ],
//       priority: 1,
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

//     // Outputs for Batch
//     new cdk.CfnOutput(this, "VRPSolverJobDefinitionArn", {
//       value: jobDefinition.ref,
//       description: "VRP Solver Job Definition ARN",
//     });

//     new cdk.CfnOutput(this, "VRPSolverJobQueueArn", {
//       value: jobQueue.ref,
//       description: "VRP Solver Job Queue ARN",
//     });
//   }
// }
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
    const placeholderImage = ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:latest');

    // Create ECS Fargate Service
    const loadBalancedFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'VRPBackendFargateService', {
      cluster: props.cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: placeholderImage,
        containerName: 'vrp-backend-container',
        containerPort: 80,
        environment: {
          VRP_DATA_TABLE: props.vrpDataTable.tableName,
          VRP_SOLUTIONS_BUCKET: props.vrpSolutionsBucket.bucketName,
        },
      },
      publicLoadBalancer: true,
    });

    // Grant permissions to the ECS task
    props.vrpDataTable.grantReadWriteData(loadBalancedFargateService.taskDefinition.taskRole);
    props.vrpSolutionsBucket.grantReadWrite(loadBalancedFargateService.taskDefinition.taskRole);

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