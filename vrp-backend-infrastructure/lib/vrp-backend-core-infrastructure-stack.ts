import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface CoreInfrastructureStackProps extends cdk.StackProps {
  environment: string;  // Add an environment field
}

export class VRPBackendCoreInfrastructureStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecrRepository: ecr.Repository;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly vrpDataTable: dynamodb.Table;
  public readonly vrpSolutionsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CoreInfrastructureStackProps) {
    super(scope, id, props);

    // Define resource names based on environment
    const environmentSuffix = props.environment;
    
    // Create a VPC for VRPBackend
    this.vpc = new ec2.Vpc(this, `VRPBackendVPC-${environmentSuffix}`, {
      maxAzs: 2,
    });

    // Create an ECR repository for storing container images for VRPBackend
    this.ecrRepository = new ecr.Repository(this, `VRPBackendRepo-${environmentSuffix}`, {
      repositoryName: `vrp-backend-repo-${environmentSuffix}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create an ECS Cluster within the VPC for VRPBackend
    this.ecsCluster = new ecs.Cluster(this, `VRPBackendCluster-${environmentSuffix}`, {
      vpc: this.vpc,
      clusterName: `vrp-backend-cluster-${environmentSuffix}`,
    });

    // Create an Application Load Balancer in the VPC for VRPBackend
    this.alb = new elbv2.ApplicationLoadBalancer(this, `VRPBackendALB-${environmentSuffix}`, {
      vpc: this.vpc,
      internetFacing: true,
    });

    // Create a security group for the ALB for VRPBackend
    const albSg = new ec2.SecurityGroup(this, `VRPBackendAlbSecurityGroup-${environmentSuffix}`, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: `Security group for the VRPBackend ALB (${environmentSuffix})`,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    // Create a DynamoDB table for storing VRP data
    this.vrpDataTable = new dynamodb.Table(this, `VRPDataTable-${environmentSuffix}`, {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create an S3 bucket for storing VRP solutions
    this.vrpSolutionsBucket = new s3.Bucket(this, `VRPSolutionsBucket-${environmentSuffix}`, {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Outputs
    new cdk.CfnOutput(this, `VRPBackendECRRepositoryUri-${environmentSuffix}`, {
      value: this.ecrRepository.repositoryUri,
      description: `VRPBackend ECR Repository URI (${environmentSuffix})`,
    });

    new cdk.CfnOutput(this, `VRPBackendALBDNSName-${environmentSuffix}`, {
      value: this.alb.loadBalancerDnsName,
      description: `VRPBackend ALB DNS Name (${environmentSuffix})`,
    });

    new cdk.CfnOutput(this, `VRPDataTableName-${environmentSuffix}`, {
      value: this.vrpDataTable.tableName,
      description: `VRP Data DynamoDB Table Name (${environmentSuffix})`,
    });

    new cdk.CfnOutput(this, `VRPSolutionsBucketName-${environmentSuffix}`, {
      value: this.vrpSolutionsBucket.bucketName,
      description: `VRP Solutions S3 Bucket Name (${environmentSuffix})`,
    });
  }
}
