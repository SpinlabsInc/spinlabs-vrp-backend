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
  environment: string;  // Add environment prop
}

export class VRPBackendCICDPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CICDPipelineStackProps) {
    super(scope, id, props);

    // Retrieve GitHub token from Secrets Manager
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'GithubToken', 'GithubToken').secretValueFromJson('GithubToken');

    // Source Action for GitHub (change the branch based on the environment)
    const sourceOutput = new codepipeline.Artifact("SourceOutput");
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: `GitHub_Source_${props.environment}`,
      owner: "SpinlabsInc",
      repo: "spinlabs-vrp-backend",
      oauthToken: githubToken,
      output: sourceOutput,
      branch: props.environment === 'prod' ? 'main' : props.environment, // Dynamically choose branch based on environment
    });

    // CodeBuild Project (Build Stage)
    const buildProject = new codebuild.PipelineProject(this, `BuildProject-${props.environment}`, {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // For Docker build
      },
      environmentVariables: {
        ECR_REPO_URI: { value: props.ecrRepository.repositoryUri },
        AWS_DEFAULT_REGION: { value: this.region },
        ENVIRONMENT: { value: props.environment },  // Add environment as a build variable
        VRP_DATA_TABLE: { value: `vrp-data-table-${props.environment}` },
        VRP_SOLUTIONS_BUCKET: { value: `vrp-solutions-bucket-${props.environment}` },
        VRP_SOLVER_JOB_DEFINITION: { value: `vrp-solver-job-definition-${props.environment}` },
        VRP_SOLVER_JOB_QUEUE: { value: `vrp-solver-job-queue-${props.environment}` },
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
      actionName: `Build_${props.environment}`,
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // Create the pipeline stages array
    const pipelineStages: codepipeline.StageProps[] = [
      {
        stageName: `Source_${props.environment}`,
        actions: [sourceAction],
      },
      {
        stageName: `Build_${props.environment}`,
        actions: [buildAction],
      }
    ];

    // Add the Manual Approval stage only for production
    if (props.environment === 'prod') {
      const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
        actionName: `Approve_${props.environment}`,
        runOrder: 1,
      });
      pipelineStages.push({
        stageName: `Approve_${props.environment}`,
        actions: [manualApprovalAction],
      });
    }

    // ECS Deploy Action in the deployment stage
    const deployAction = new codepipeline_actions.EcsDeployAction({
      actionName: `DeployToECS_${props.environment}`,
      service: props.ecsService,
      imageFile: new codepipeline.ArtifactPath(buildOutput, "imageDetail.json"),
      deploymentTimeout: cdk.Duration.minutes(60),
      runOrder: 2,
    });

    pipelineStages.push({
      stageName: `Deploy_${props.environment}`,
      actions: [deployAction],
    });

    // Define the Pipeline
    const pipeline = new codepipeline.Pipeline(this, `Pipeline-${props.environment}`, {
      pipelineName: `VRPBackendPipeline-${props.environment}`,
      stages: pipelineStages,
    });

    // CloudWatch Alarm for Pipeline Failures
    new cloudwatch.Alarm(this, `PipelineFailureAlarm-${props.environment}`, {
      metric: new cloudwatch.Metric({
        namespace: "AWS/CodePipeline",
        metricName: "PipelineExecutionFailure",
        dimensionsMap: {
          PipelineName: pipeline.pipelineName,
        },
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: `Pipeline has failed in ${props.environment} environment`,
    });

    // Outputs for ECS Cluster and Service Names
    new cdk.CfnOutput(this, `EcsClusterName-${props.environment}`, {
      value: props.ecsCluster.clusterName,
      description: `Name of the ECS Cluster in ${props.environment} environment`,
    });

    new cdk.CfnOutput(this, `EcsServiceName-${props.environment}`, {
      value: props.ecsService.serviceName,
      description: `Name of the ECS Service in ${props.environment} environment`,
    });
  }
}
