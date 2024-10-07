import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface CognitoStackProps extends cdk.StackProps {
  environment: string;  // Add an environment property
}

export class VRPBackendCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  private readonly userPoolName: string; // Define userPoolName as a class property

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    this.userPoolName = `VRPBackendUserPool-${props.environment}`;

    // Create a Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'VRPBackendUserPool', {
      userPoolName: this.userPoolName,  // Use environment-specific pool name
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: `The ID of the Cognito User Pool (${props.environment} environment)`,
    });

    new cdk.CfnOutput(this, 'UserPoolName', {
      value: this.userPoolName,
      description: `The name of the Cognito User Pool (${props.environment} environment)`,
    });
  }
}