import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

interface CICDPipelineStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsCluster: ecs.Cluster;
  ecsService: ecs.FargateService;
}

export class VRPBackendCICDPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CICDPipelineStackProps) {
    super(scope, id, props);

    // Retrieve GitHub token from Secrets Manager
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'GithubToken', 'GithubToken').secretValueFromJson('GithubToken');

    // Source Action for GitHub
    const sourceOutput = new codepipeline.Artifact("SourceOutput");
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "GitHub_Source",
      owner: "SpinlabsInc",
      repo: "spinlabs-vrp-backend",
      oauthToken: githubToken,
      output: sourceOutput,
      branch: "main",
    });

    // CodeBuild Project
    const buildProject = new codebuild.PipelineProject(this, "BuildProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // For Docker build
      },
      environmentVariables: {
        ECR_REPO_URI: { value: props.ecrRepository.repositoryUri },
        AWS_DEFAULT_REGION: { value: this.region },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec.yml"),
    });

    // Grant ECR pull/push permissions
    props.ecrRepository.grantPullPush(buildProject.role!);

    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          "arn:aws:secretsmanager:us-east-1:448049814374:secret:DockerHubCredentials-HH2LVS",
        ],
      })
    );

    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
        ],
        resources: ["*"],
      })
    );

    // Build output artifact
    const buildOutput = new codepipeline.Artifact("BuildOutput");
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // Manual Approval Action
    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: "Approve",
      runOrder: 1,
    });

    // ECS Deploy Action
    const deployAction = new codepipeline_actions.EcsDeployAction({
      actionName: "DeployToECS",
      service: props.ecsService,
      imageFile: new codepipeline.ArtifactPath(buildOutput, "imageDetail.json"),
      deploymentTimeout: cdk.Duration.minutes(60),
      runOrder: 2,
    });

    // Define the Pipeline
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "LaundryServicePipeline",
      stages: [
        {
          stageName: "Source",
          actions: [sourceAction],
        },
        {
          stageName: "Build",
          actions: [buildAction],
        },
        {
          stageName: "Approve",
          actions: [manualApprovalAction],
        },
        {
          stageName: "Deploy",
          actions: [deployAction],
        },
      ],
    });

    // CloudWatch Alarm for Pipeline Failures
    new cloudwatch.Alarm(this, "PipelineFailureAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/CodePipeline",
        metricName: "PipelineExecutionFailure",
        dimensionsMap: {
          PipelineName: pipeline.pipelineName,
        },
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Pipeline has failed",
    });

    // Outputs for ECS Cluster and Service Names
    new cdk.CfnOutput(this, "EcsClusterName", {
      value: props.ecsCluster.clusterName,
      description: "Name of the ECS Cluster",
    });

    new cdk.CfnOutput(this, "EcsServiceName", {
      value: props.ecsService.serviceName,
      description: "Name of the ECS Service",
    });
  }
}
