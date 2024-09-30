import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class VRPBackendCoreInfrastructureStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecrRepository: ecr.Repository;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly vrpDataTable: dynamodb.Table;
  public readonly vrpSolutionsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC for VRPBackend
    this.vpc = new ec2.Vpc(this, "VRPBackendVPC", {
      maxAzs: 2,
    });

    // Create an ECR repository for storing container images for VRPBackend
    this.ecrRepository = new ecr.Repository(this, "VRPBackendRepo", {
      repositoryName: "vrp-backend-repo",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create an ECS Cluster within the VPC for VRPBackend
    this.ecsCluster = new ecs.Cluster(this, "VRPBackendCluster", {
      vpc: this.vpc,
      clusterName: "vrp-backend-cluster",
    });

    // Create an Application Load Balancer in the VPC for VRPBackend
    this.alb = new elbv2.ApplicationLoadBalancer(this, "VRPBackendALB", {
      vpc: this.vpc,
      internetFacing: true,
    });

    // Create a security group for the ALB for VRPBackend
    const albSg = new ec2.SecurityGroup(this, "VRPBackendAlbSecurityGroup", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "Security group for the VRPBackend ALB",
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    // Create a DynamoDB table for storing VRP data
    this.vrpDataTable = new dynamodb.Table(this, "VRPDataTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create an S3 bucket for storing VRP solutions
    this.vrpSolutionsBucket = new s3.Bucket(this, "VRPSolutionsBucket", {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Outputs
    new cdk.CfnOutput(this, "VRPBackendECRRepositoryUri", {
      value: this.ecrRepository.repositoryUri,
      description: "VRPBackend ECR Repository URI",
    });

    new cdk.CfnOutput(this, "VRPBackendALBDNSName", {
      value: this.alb.loadBalancerDnsName,
      description: "VRPBackend ALB DNS Name",
    });

    new cdk.CfnOutput(this, "VRPDataTableName", {
      value: this.vrpDataTable.tableName,
      description: "VRP Data DynamoDB Table Name",
    });

    new cdk.CfnOutput(this, "VRPSolutionsBucketName", {
      value: this.vrpSolutionsBucket.bucketName,
      description: "VRP Solutions S3 Bucket Name",
    });
  }
}
// import * as cdk from "aws-cdk-lib";
// import * as ec2 from "aws-cdk-lib/aws-ec2";
// import * as ecs from "aws-cdk-lib/aws-ecs";
// import * as ecr from "aws-cdk-lib/aws-ecr";
// import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
// import * as s3 from "aws-cdk-lib/aws-s3";
// import { Construct } from "constructs";

// export class VRPBackendCoreInfrastructureStack extends cdk.Stack {
//   public readonly vpc: ec2.Vpc;
//   public readonly ecsCluster: ecs.Cluster;
//   public readonly ecrRepository: ecr.Repository;
//   public readonly vrpDataTable: dynamodb.Table;
//   public readonly vrpSolutionsBucket: s3.Bucket;

//   constructor(scope: Construct, id: string, props?: cdk.StackProps) {
//     super(scope, id, props);

//     // Create a VPC for VRPBackend without NAT Gateway
//     this.vpc = new ec2.Vpc(this, "VRPBackendVPC", {
//       maxAzs: 2,
//       natGateways: 0, // Disable NAT Gateway to reduce cost
//       subnetConfiguration: [
//         {
//           name: "Public",
//           subnetType: ec2.SubnetType.PUBLIC,
//         },
//         {
//           name: "PrivateWithNat",
//           subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // Create private subnets
//         },
//       ],
//     });

//     // Create a NAT Instance for private subnet internet access
//     const natInstance = new ec2.Instance(this, "NATInstance", {
//       vpc: this.vpc,
//       instanceType: new ec2.InstanceType("t3.micro"),
//       machineImage: new ec2.AmazonLinuxImage(),
//       vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // NAT Instance in public subnet
//     });

//     // Configure private subnet to use NAT instance
//     this.vpc.privateSubnets.forEach((subnet, index) => {
//       new ec2.CfnRoute(this, `NatRoutePrivateSubnet${index}`, {
//         routeTableId: subnet.routeTable.routeTableId,
//         destinationCidrBlock: "0.0.0.0/0", // Route all traffic
//         instanceId: natInstance.instanceId, // Route through NAT instance
//       });
//     });

//     // Create Gateway VPC Endpoint for S3
//     new ec2.GatewayVpcEndpoint(this, "S3VpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.GatewayVpcEndpointAwsService.S3,
//     });

//     // Create Gateway VPC Endpoint for DynamoDB
//     new ec2.GatewayVpcEndpoint(this, "DynamoDbVpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
//     });

//     // Add VPC Endpoints for ECS, ECS Agent, ECS Telemetry, ECR, and ECR Docker to reduce reliance on NAT
//     new ec2.InterfaceVpcEndpoint(this, "ECSVpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.InterfaceVpcEndpointAwsService.ECS,
//     });

//     new ec2.InterfaceVpcEndpoint(this, "ECSAgentVpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.InterfaceVpcEndpointAwsService.ECS_AGENT,
//     });

//     new ec2.InterfaceVpcEndpoint(this, "ECSTelemetryVpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
//     });

//     new ec2.InterfaceVpcEndpoint(this, "ECRVpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.InterfaceVpcEndpointAwsService.ECR,
//     });

//     new ec2.InterfaceVpcEndpoint(this, "ECRDockerVpcEndpoint", {
//       vpc: this.vpc,
//       service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
//     });

//     // Create ECR repository for container images with lifecycle policy
//     this.ecrRepository = new ecr.Repository(this, "VRPBackendRepo", {
//       repositoryName: "vrp-backend-repo",
//       removalPolicy: cdk.RemovalPolicy.DESTROY,
//       lifecycleRules: [
//         {
//           rulePriority: 1,
//           tagStatus: ecr.TagStatus.ANY,
//           maxImageCount: 10, // Keep the latest 10 images
//         },
//       ],
//     });

//     // Create ECS Cluster within the VPC
//     this.ecsCluster = new ecs.Cluster(this, "VRPBackendCluster", {
//       vpc: this.vpc,
//       clusterName: "vrp-backend-cluster",
//     });

//     // Create a DynamoDB table for VRP data
//     this.vrpDataTable = new dynamodb.Table(this, "VRPDataTable", {
//       partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
//       billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
//       removalPolicy: cdk.RemovalPolicy.DESTROY,
//     });

//     // Create an S3 bucket for storing VRP solutions
//     this.vrpSolutionsBucket = new s3.Bucket(this, "VRPSolutionsBucket", {
//       versioned: true,
//       encryption: s3.BucketEncryption.S3_MANAGED,
//       removalPolicy: cdk.RemovalPolicy.DESTROY,
//       autoDeleteObjects: true,
//     });

//     // Outputs
//     new cdk.CfnOutput(this, "VRPBackendECRRepositoryUri", {
//       value: this.ecrRepository.repositoryUri,
//       description: "VRPBackend ECR Repository URI",
//     });

//     new cdk.CfnOutput(this, "VRPDataTableName", {
//       value: this.vrpDataTable.tableName,
//       description: "VRP Data DynamoDB Table Name",
//     });

//     new cdk.CfnOutput(this, "VRPSolutionsBucketName", {
//       value: this.vrpSolutionsBucket.bucketName,
//       description: "VRP Solutions S3 Bucket Name",
//     });
//   }
// }
