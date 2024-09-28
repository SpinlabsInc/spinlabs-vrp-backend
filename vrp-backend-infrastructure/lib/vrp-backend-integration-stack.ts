import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface IntegrationStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
  authorizer: apigateway.CognitoUserPoolsAuthorizer;
  loadBalancer: elbv2.IApplicationLoadBalancer;
}

export class VRPBackendIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IntegrationStackProps) {
    super(scope, id, props);

    const integration = new apigateway.HttpIntegration(`http://${props.loadBalancer.loadBalancerDnsName}/api/{proxy}`, {
      httpMethod: 'ANY',
      options: {
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
        },
      },
    });

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
      // If 'ANY' method exists, you might want to update it or log a message
      console.log("'ANY' method already exists for the proxy resource");
    }
  }
}