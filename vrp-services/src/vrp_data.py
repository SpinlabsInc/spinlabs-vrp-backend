import os
import boto3
import json
from decimal import Decimal
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Check if running in local mode
USE_LOCAL_DB = os.environ.get('USE_LOCAL_DB', 'False').lower() == 'true'

# Initialize DynamoDB client
if USE_LOCAL_DB:
    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url='http://localhost:4566',
        region_name='us-east-1'
    )
else:
    dynamodb = boto3.resource('dynamodb')

table = dynamodb.Table(os.environ['VRP_DATA_TABLE'])

def get_vrp_data():
    """Retrieve VRP data from DynamoDB."""
    response = table.get_item(Key={'id': 'current_data'})
    if 'Item' in response:
        return response['Item']['data']
    return None

def update_vrp_data(new_data):
    """Update VRP data in DynamoDB."""
    table.put_item(Item={
        'id': 'current_data',
        'data': new_data
    })

def initialize_data():
    """Initialize VRP data in DynamoDB with some default values."""
    try:
        initial_data = {
            'locations': [
                (Decimal('17.9787'), Decimal('79.6010')),  # Warangal
                (Decimal('17.9607'), Decimal('79.5946')),  # Warangal Fort
                (Decimal('17.9940'), Decimal('79.5947')),  # Matwada
                (Decimal('17.9567'), Decimal('79.5930')),  # Fort Road
                (Decimal('17.9936'), Decimal('79.5292')),  # Madikonda
            ],
            'time_windows': [
                (540, 1260),  # 9:00 AM to 9:00 PM
                (615, 795),   # 10:15 AM to 1:15 PM
                (930, 1110),  # 3:30 PM to 6:30 PM
                (645, 825),   # 10:45 AM to 1:45 PM
                (1005, 1185), # 4:45 PM to 7:45 PM
            ],
            'service_times': [Decimal('0'), Decimal('15'), Decimal('20'), Decimal('18'), Decimal('22')],
            'num_vehicles': 4
        }
        update_vrp_data(initial_data)
        print("Initial data loaded into DynamoDB")
    except Exception as e:
        print(f"Error uploading data to DynamoDB: {e}")


if __name__ == "__main__":
    # This block can be used to initialize the data in DynamoDB
    initialize_data()
    print("Initial data loaded into DynamoDB")
