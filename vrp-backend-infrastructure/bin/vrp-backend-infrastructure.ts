#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VRPBackendCoreInfrastructureStack } from "../lib/vrp-backend-core-infrastructure-stack";
import { VRPBackendEcsServiceStack } from "../lib/vrp-backend-ecs-service-stack";
import { VRPBackendCICDPipelineStack } from "../lib/vrp-backend-cicd-pipeline-stack";
import { VRPBackendCognitoStack } from "../lib/vrp-backend-cognito-stack";
import { VRPBackendApiGatewayStack } from "../lib/vrp-api-gateway-stack";
import { VRPBackendIntegrationStack } from "../lib/vrp-backend-integration-stack";

const app = new cdk.App();

// List of environments
const environments = ['dev', 'test', 'prod'];

// Iterate over environments and deploy stacks
environments.forEach(env => {
  const envConfig = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

  // Deploy the core infrastructure stack
  const coreStack = new VRPBackendCoreInfrastructureStack(app, `VRPBackendCoreInfrastructureStack-${env}`, {
    env: envConfig,
    environment: env,
  });

  // Deploy the Cognito stack
  const cognitoStack = new VRPBackendCognitoStack(app, `VRPBackendCognitoStack-${env}`, {
    env: envConfig,
    environment: env,
  });

  // Deploy the API Gateway stack, passing the Cognito User Pool
  const apiGatewayStack = new VRPBackendApiGatewayStack(app, `VRPBackendApiGatewayStack-${env}`, {
    cognitoUserPool: cognitoStack.userPool,
    env: envConfig,
    environment: env,
  });

  // Deploy the ECS service stack, utilizing resources from the core stack
  const ecsServiceStack = new VRPBackendEcsServiceStack(app, `VRPBackendEcsServiceStack-${env}`, {
    cluster: coreStack.ecsCluster,
    repository: coreStack.ecrRepository,
    vrpDataTable: coreStack.vrpDataTable,
    vrpSolutionsBucket: coreStack.vrpSolutionsBucket,
    vpc: coreStack.vpc,
    env: envConfig,
    environment: env,
  });

  // Deploy the Integration stack
  new VRPBackendIntegrationStack(app, `VRPBackendIntegrationStack-${env}`, {
    api: apiGatewayStack.api,
    authorizer: apiGatewayStack.authorizer,
    loadBalancer: ecsServiceStack.loadBalancer,
    env: envConfig,
    environment: env,
  });

  // Deploy the CICD pipeline stack
  new VRPBackendCICDPipelineStack(app, `VRPBackendCICDPipelineStack-${env}`, {
    ecrRepository: coreStack.ecrRepository,
    ecsCluster: coreStack.ecsCluster,
    ecsService: ecsServiceStack.fargateService,
    env: envConfig,
    environment: env,
  });
});

app.synth();
