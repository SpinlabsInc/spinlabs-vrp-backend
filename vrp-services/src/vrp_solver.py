import os
import boto3
import json
from datetime import datetime, timedelta
from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from geopy.distance import geodesic
import logging
from botocore.exceptions import NoCredentialsError

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize environment variables
USE_LOCAL_DB = os.environ.get('USE_LOCAL_DB', 'False').lower() == 'true'
LOCALSTACK_ENDPOINT = os.environ.get('LOCALSTACK_ENDPOINT', 'http://localhost:4566')
VRP_SOLUTIONS_BUCKET = os.environ.get('VRP_SOLUTIONS_BUCKET', 'my-local-bucket')
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL', 'http://localhost:4566/queue/vrp-sqs')

# Initialize S3 and SQS clients
if USE_LOCAL_DB:
    s3_client = boto3.client(
        's3',
        endpoint_url=LOCALSTACK_ENDPOINT,
        aws_access_key_id='dummy',
        aws_secret_access_key='dummy',
        region_name='us-east-1'
    )
    sqs_client = boto3.client(
        'sqs',
        endpoint_url=LOCALSTACK_ENDPOINT,
        aws_access_key_id='dummy',
        aws_secret_access_key='dummy',
        region_name='us-east-1'
    )
else:
    s3_client = boto3.client('s3')
    sqs_client = boto3.client('sqs')

def format_time(minutes):
    """Convert minutes since midnight to HH:MM format."""
    return (datetime.min + timedelta(minutes=int(minutes))).strftime("%I:%M %p")

def create_data_model(dynamodb, table_name):
    """Fetch the data from DynamoDB to initialize the VRP problem."""
    table = dynamodb.Table(table_name)
    response = table.get_item(Key={'id': 'current_data'})
    if 'Item' not in response:
        raise Exception(f"No data found in {table_name} with id 'current_data'.")

    # Extract data
    item = response['Item']['data']
    num_vehicles = int(item['num_vehicles'])

    time_windows = [(int(start), int(end)) for start, end in item['time_windows']]

    data = {
        'locations': item['locations'],
        'time_windows': time_windows,
        'service_times': item['service_times'],
        'num_vehicles': num_vehicles,
        'depot': item['depot'],
        'starts': [0] * num_vehicles,
        'ends': [0] * num_vehicles
    }

    data['distance_matrix'] = [
        [int(geodesic(loc1, loc2).miles * 10) for loc2 in data['locations']]
        for loc1 in data['locations']
    ]
    return data

def solve_vrp(dynamodb, table_name):
    """Solve the VRP problem and store the solution in S3."""
    data = create_data_model(dynamodb, table_name)
    manager = pywrapcp.RoutingIndexManager(len(data['distance_matrix']), data['num_vehicles'], data['starts'], data['ends'])
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['distance_matrix'][from_node][to_node] + data['service_times'][from_node]

    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    time = 'Time'
    routing.AddDimension(
        transit_callback_index,
        30,  # allow waiting time
        1260,  # maximum time per vehicle
        False,
        time)
    time_dimension = routing.GetDimensionOrDie(time)
    time_dimension.SetGlobalSpanCostCoefficient(100)

    for location_idx, time_window in enumerate(data['time_windows']):
        if location_idx == data['depot']:
            continue
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)

    solution = routing.SolveWithParameters(search_parameters)

    if solution:
        solution_data = format_solution(data, manager, routing, solution)
        file_name = upload_solution_to_s3(solution_data)  # Upload solution to S3
        send_solution_to_sqs(file_name, solution_data)    # Send message to SQS
        return {"status": "success", "message": "Solution processed and stored", "file_name": file_name}
    else:
        logger.error("No solution found.")
        return {"status": "error", "message": "No solution found"}

def format_solution(data, manager, routing, solution):
    time_dimension = routing.GetDimensionOrDie('Time')
    depots = data['starts']
    locations = [[float(location[0]), float(location[1])] for location in data['locations']]

    total_time = 0
    routes = []

    for vehicle_id in range(data['num_vehicles']):
        index = routing.Start(vehicle_id)
        route = []
        while not routing.IsEnd(index):
            time_var = time_dimension.CumulVar(index)
            node = manager.IndexToNode(index)
            arrival_time = solution.Min(time_var)
            start_time = arrival_time
            if node != data['depot']:
                start_time += data['service_times'][node]

            route.append({
                'location': node,
                'arrival_time': format_time(arrival_time),
                'service_time': float(data['service_times'][node]),
                'start_time': format_time(start_time)
            })

            index = solution.Value(routing.NextVar(index))

        time_var = time_dimension.CumulVar(index)
        route.append({
            'location': manager.IndexToNode(index),
            'arrival_time': format_time(solution.Min(time_var)),
            'service_time': 0,
            'start_time': format_time(solution.Min(time_var))
        })
        routes.append(route)
        total_time += solution.Min(time_var)

    return {
        'depots': depots,
        'locations': locations,
        'solution': {
            'objective_value': solution.ObjectiveValue(),
            'routes': routes,
            'total_time': total_time
        }
    }

def upload_solution_to_s3(solution_data):
    try:
        solution_json = json.dumps(solution_data, indent=4)
        file_name = f"vrp_solution_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"

        # Upload the solution to S3
        s3_client.put_object(
            Bucket=VRP_SOLUTIONS_BUCKET,
            Key=file_name,
            Body=solution_json,
            ContentType='application/json'
        )
        logger.info(f"Solution successfully uploaded to S3 as {file_name}")
        return file_name
    except NoCredentialsError:
        logger.error("No valid AWS credentials found. Please check your configuration.")
        return None
    except Exception as e:
        logger.error(f"Error uploading solution to S3: {e}")
        return None

def send_solution_to_sqs(file_name, solution_data):
    """Send the VRP solution details to the SQS queue."""
    try:
        message_body = {
            'file_name': file_name,
            'message': 'VRP solution processed and stored.',
            'solution_data': solution_data
        }
        response = sqs_client.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message_body)
        )
        logger.info(f"Message sent to SQS: {response['MessageId']}")
    except Exception as e:
        logger.error(f"Error sending message to SQS: {e}")
