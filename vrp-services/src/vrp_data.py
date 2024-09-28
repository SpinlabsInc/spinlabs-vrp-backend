import boto3
import json

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('vrp_data')

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
    initial_data = {
        'locations': [
            (17.9787, 79.6010),  # Warangal
            (17.9607, 79.5946),  # Warangal Fort
            (17.9940, 79.5947),  # Matwada
            (17.9567, 79.5930),  # Fort Road
            (17.9936, 79.5292),  # Madikonda
        ],
        'time_windows': [
            (540, 1260),  # 9:00 AM to 9:00 PM
            (615, 795),   # 10:15 AM to 1:15 PM
            (930, 1110),  # 3:30 PM to 6:30 PM
            (645, 825),   # 10:45 AM to 1:45 PM
            (1005, 1185), # 4:45 PM to 7:45 PM
        ],
        'service_times': [0, 15, 20, 18, 22],
        'num_vehicles': 4
    }
    update_vrp_data(initial_data)

if __name__ == "__main__":
    # This block can be used to initialize the data in DynamoDB
    initialize_data()
    print("Initial data loaded into DynamoDB")