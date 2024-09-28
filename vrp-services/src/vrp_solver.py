import boto3
import json
from vrp_solver import solve_vrp

sqs = boto3.client('sqs')
s3 = boto3.client('s3')

def process_vrp_request(event, context):
    # Assume the event contains the SQS message
    message = json.loads(event['Records'][0]['body'])
    
    # Solve VRP
    solution = solve_vrp(message['data'])
    
    # Store solution in S3
    s3.put_object(
        Bucket='vrp-solutions',
        Key=f"solution_{message['id']}.json",
        Body=json.dumps(solution)
    )
    
    # Optionally, send a notification that processing is complete

if __name__ == "__main__":
    # This block is for local testing
    test_event = {
        'Records': [{
            'body': json.dumps({
                'id': 'test_1',
                'data': {
                    # VRP problem data
                }
            })
        }]
    }
    process_vrp_request(test_event, None)