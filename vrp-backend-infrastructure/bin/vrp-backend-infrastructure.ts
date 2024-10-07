#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VRPBackendCoreInfrastructureStack } from "../lib/vrp-backend-core-infrastructure-stack";
import { VRPBackendEcsServiceStack } from "../lib/vrp-backend-ecs-service-stack";
import { VRPBackendCICDPipelineStack } from "../lib/vrp-backend-cicd-pipeline-stack";
import { VRPBackendCognitoStack } from "../lib/vrp-backend-cognito-stack";
import { VRPBackendApiGatewayStack } from "../lib/vrp-api-gateway-stack";
import { VRPBackendIntegrationStack } from "../lib/vrp-backend-integration-stack";

const app = new cdk.App();

// Retrieve the environment from the context
const environment = app.node.tryGetContext('env') || 'develop';

// Make sure the environment is one of the expected values
const validEnvironments = ['develop', 'test', 'prod'];


if (!validEnvironments.includes(environment)) {
  throw new Error(`Invalid environment: ${environment}. Valid environments are ${validEnvironments.join(', ')}.`);
}

console.log(`Deploying to environment: ${environment}`);
const envConfig = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

// Deploy the core infrastructure stack
const coreStack = new VRPBackendCoreInfrastructureStack(app, `VRPBackendCoreInfrastructureStack-${environment}`, {
  env: envConfig,
  environment,
});

// Deploy the Cognito stack
const cognitoStack = new VRPBackendCognitoStack(app, `VRPBackendCognitoStack-${environment}`, {
  env: envConfig,
  environment,
});

// Deploy the API Gateway stack, passing the Cognito User Pool
const apiGatewayStack = new VRPBackendApiGatewayStack(app, `VRPBackendApiGatewayStack-${environment}`, {
  cognitoUserPool: cognitoStack.userPool,
  env: envConfig,
  environment,
});

// Deploy the ECS service stack, utilizing resources from the core stack
const ecsServiceStack = new VRPBackendEcsServiceStack(app, `VRPBackendEcsServiceStack-${environment}`, {
  cluster: coreStack.ecsCluster,
  repository: coreStack.ecrRepository,
  vrpDataTable: coreStack.vrpDataTable,
  vrpSolutionsBucket: coreStack.vrpSolutionsBucket,
  vpc: coreStack.vpc,
  env: envConfig,
  environment,
});

// Deploy the Integration stack
new VRPBackendIntegrationStack(app, `VRPBackendIntegrationStack-${environment}`, {
  api: apiGatewayStack.api,
  authorizer: apiGatewayStack.authorizer,
  loadBalancer: ecsServiceStack.loadBalancer,
  env: envConfig,
  environment,
});

// Deploy the CICD pipeline stack
new VRPBackendCICDPipelineStack(app, `VRPBackendCICDPipelineStack-${environment}`, {
  ecrRepository: coreStack.ecrRepository,
  ecsCluster: coreStack.ecsCluster,
  ecsService: ecsServiceStack.fargateService,
  env: envConfig,
  environment,
});

app.synth();
