#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VRPBackendCoreInfrastructureStack } from "../lib/vrp-backend-core-infrastructure-stack";
import { VRPBackendEcsServiceStack } from "../lib/vrp-backend-ecs-service-stack";
import { VRPBackendCICDPipelineStack } from "../lib/vrp-backend-cicd-pipeline-stack";
import { VRPBackendCognitoStack } from "../lib/vrp-backend-cognito-stack";
import { VRPBackendApiGatewayStack } from "../lib/vrp-api-gateway-stack";
import { VRPBackendIntegrationStack } from "../lib/vrp-backend-integration-stack";

const app = new cdk.App();

// Deploy the core infrastructure stack
const coreStack = new VRPBackendCoreInfrastructureStack(app, "VRPBackendCoreInfrastructureStack");

// Deploy the Cognito stack
const cognitoStack = new VRPBackendCognitoStack(app, "VRPBackendCognitoStack");

// Deploy the API Gateway stack, passing the Cognito User Pool
const apiGatewayStack = new VRPBackendApiGatewayStack(app, "VRPBackendApiGatewayStack", {
  cognitoUserPool: cognitoStack.userPool,
});

// Deploy the ECS service stack, utilizing resources from the core stack
const ecsServiceStack = new VRPBackendEcsServiceStack(app, "VRPBackendEcsServiceStack", {
  cluster: coreStack.ecsCluster,
  repository: coreStack.ecrRepository,
  vrpDataTable: coreStack.vrpDataTable,
  vrpSolutionsBucket: coreStack.vrpSolutionsBucket,
  vpc: coreStack.vpc,
});

// Deploy the Integration stack
new VRPBackendIntegrationStack(app, "VRPBackendIntegrationStack", {
  api: apiGatewayStack.api,
  authorizer: apiGatewayStack.authorizer,
  loadBalancer: ecsServiceStack.loadBalancer,
});

// Deploy the CICD pipeline stack
new VRPBackendCICDPipelineStack(app, "VRPBackendCICDPipelineStack", {
  ecrRepository: coreStack.ecrRepository,
  ecsCluster: coreStack.ecsCluster,
  ecsService: ecsServiceStack.fargateService,
});

app.synth();