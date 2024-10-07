import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface ApiGatewayStackProps extends cdk.StackProps {
  cognitoUserPool: cognito.IUserPool;  // Pass the User Pool from Cognito stack
  environment: string; 
}

export class VRPBackendApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'VRPBackendApi', {
      restApiName: 'VRP Backend Service',
      description: 'This service serves VRP backend.',
    });

    // Create Cognito Authorizer for API Gateway in the same stack as the API Gateway
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'VRPBackendApiAuthorizer', {
      cognitoUserPools: [props.cognitoUserPool],  // Attach the provided Cognito User Pool
    });

    // Attach the authorizer to the API methods
    const proxyResource = this.api.root.getResource('{proxy+}') || this.api.root.addResource('{proxy+}');

    proxyResource.addMethod('ANY', new apigateway.MockIntegration(), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    cdk.Tags.of(this).add('Environment', props.environment);

    // Outputs
    new cdk.CfnOutput(this, 'VRPBackendApiUrl', {
      value: this.api.url,
      description: 'The URL for the VRP Backend API',
    });
  }
}
