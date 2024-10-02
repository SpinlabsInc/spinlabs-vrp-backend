import os
import boto3
import json
from decimal import Decimal
from dotenv import load_dotenv
from vrp_solver import solve_vrp

# Load environment variables from .env file
load_dotenv()

# Check if running in local mode
USE_LOCAL_DB = os.environ.get('USE_LOCAL_DB', 'False').lower() == 'true'

# Initialize SQS and S3 clients
sqs = boto3.client('sqs')
if USE_LOCAL_DB:
    s3 = boto3.client(
        's3',
        endpoint_url='http://localhost:4566',
        region_name='us-east-1'
    )
else:
    s3 = boto3.client('s3')

def process_vrp_request(event, context):
    # Assume the event contains the SQS message
    message = json.loads(event['Records'][0]['body'])

    # Solve VRP
    solution = solve_vrp(message['data'])

    # Store solution in S3
    s3.put_object(
        Bucket=os.environ['VRP_SOLUTIONS_BUCKET'],
        Key=f"solution_{message['id']}.json",
        Body=json.dumps(solution, default=str)  # Convert Decimals to string
    )

if __name__ == "__main__":
    # This block is for local testing
    test_event = {
        'Records': [{
            'body': json.dumps({
                'id': 'test_1',
                'data': {
                    'locations': [
                        [17.9787, 79.6010],
                        [17.9607, 79.5946],
                        [17.9940, 79.5947]
                    ],
                    'time_windows': [
                        [540, 1260],
                        [615, 795],
                        [930, 1110]
                    ],
                    'service_times': [0, 15, 20],
                    'num_vehicles': 4
                }
            })
        }]
    }
    process_vrp_request(test_event, None)
