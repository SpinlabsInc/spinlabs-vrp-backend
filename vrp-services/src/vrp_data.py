import os
import boto3
import logging
from data import locations, time_windows, service_times
from botocore.exceptions import ClientError
from dotenv import load_dotenv
load_dotenv()


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize AWS clients
session = boto3.Session()
dynamodb = session.resource('dynamodb')
s3_client = session.client('s3')

# Get environment variables
# ENVIRONMENT = os.getenv('ENVIRONMENT', 'develop')
VRP_DATA_TABLE = os.getenv('VRP_DATA_TABLE')
VRP_SOLUTIONS_BUCKET = os.getenv('VRP_SOLUTIONS_BUCKET')

def create_s3_bucket(bucket_name):
    """Create an S3 bucket if it doesn't already exist."""
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        logger.info(f"Bucket '{bucket_name}' already exists.")
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            try:
                s3_client.create_bucket(Bucket=bucket_name)
                logger.info(f"Bucket '{bucket_name}' created successfully.")
            except ClientError as err:
                logger.error(f"Error creating S3 bucket: {err}")
        else:
            logger.error(f"Error checking bucket: {e}")

# def create_sqs_queue(queue_name):
#     """Create an SQS queue if it doesn't already exist and return its URL."""
#     try:
#         response = sqs_client.get_queue_url(QueueName=queue_name)
#         queue_url = response['QueueUrl']
#         logger.info(f"SQS queue '{queue_name}' already exists with URL: {queue_url}")
#     except ClientError as e:
#         if e.response['Error']['Code'] == 'AWS.SimpleQueueService.NonExistentQueue':
#             try:
#                 response = sqs_client.create_queue(QueueName=queue_name)
#                 queue_url = response['QueueUrl']
#                 logger.info(f"SQS queue '{queue_name}' created successfully with URL: {queue_url}")
#             except ClientError as err:
#                 logger.error(f"Error creating SQS queue: {err}")
#                 return None
#         else:
#             logger.error(f"Error retrieving SQS queue URL: {e}")
#             return None
#     return queue_url

def initialize_data():
    """Create the DynamoDB table, S3 bucket, and SQS queue, then insert initial data."""
    try:
        create_s3_bucket(VRP_SOLUTIONS_BUCKET)

        # Create the SQS queue and set the URL in the environment
        # queue_url = create_sqs_queue(SQS_QUEUE_NAME)
        # if queue_url:
        #     os.environ['SQS_QUEUE_URL'] = queue_url
        # else:
        #     logger.error("Failed to create or retrieve the SQS queue URL.")

        # Check if the DynamoDB table already exists
        table = dynamodb.Table(VRP_DATA_TABLE)
        try:
            table.load()
            logger.info(f"Table {VRP_DATA_TABLE} already exists.")
        except dynamodb.meta.client.exceptions.ResourceNotFoundException:
            table = dynamodb.create_table(
                TableName=VRP_DATA_TABLE,
                KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
                AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
                ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            )
            table.wait_until_exists()
            logger.info(f"Table {VRP_DATA_TABLE} created successfully.")

        # Insert initial VRP data into DynamoDB
        initial_data = {
            'locations': locations,
            'time_windows': time_windows,
            'service_times': service_times,
            'num_vehicles': 4,
            'depot': 0
        }

        table.put_item(Item={
            'id': 'current_data',
            'data': initial_data
        })
        logger.info("Initial data loaded into DynamoDB.")

    except Exception as e:
        logger.error(f"Error initializing data: {e}")

if __name__ == "__main__":
    initialize_data()
