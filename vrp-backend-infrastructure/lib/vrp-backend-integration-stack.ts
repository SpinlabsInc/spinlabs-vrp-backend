import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface IntegrationStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
  authorizer: apigateway.CognitoUserPoolsAuthorizer;
  loadBalancer: elbv2.IApplicationLoadBalancer;
  environment: string;  // Add environment property
}

export class VRPBackendIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IntegrationStackProps) {
    super(scope, id, props);

    // Use environment to define environment-specific integration
    const integration = new apigateway.HttpIntegration(
      `http://${props.loadBalancer.loadBalancerDnsName}/api/{proxy}`, 
      {
        httpMethod: 'ANY',
        options: {
          requestParameters: {
            'integration.request.path.proxy': 'method.request.path.proxy',
          },
        },
      }
    );

    const proxyResource = props.api.root.getResource('{proxy+}') || props.api.root.addResource('{proxy+}');

    const methodOptions: apigateway.MethodOptions = {
      authorizer: props.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.path.proxy': true,
      }
    };

    // Check if 'ANY' method already exists
    const existingAnyMethod = proxyResource.node.tryFindChild('ANY') as apigateway.Method;
    if (!existingAnyMethod) {
      // If 'ANY' method doesn't exist, add it
      proxyResource.addMethod('ANY', integration, methodOptions);
    } else {
      console.log("'ANY' method already exists for the proxy resource");
    }

    // Outputs specific to the environment
    new cdk.CfnOutput(this, `VRPBackendIntegrationStackApiUrl-${props.environment}`, {
      value: props.api.url,
      description: `The URL for the VRP Backend API for the ${props.environment} environment`,
    });
  }
}
