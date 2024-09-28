import os
import json
import boto3
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from geopy.distance import geodesic

# Initialize AWS clients
s3 = boto3.client('s3')

# Get environment variables
VRP_SOLUTIONS_BUCKET = os.environ['VRP_SOLUTIONS_BUCKET']

def create_data_model(vrp_data):
    """Stores the data for the problem."""
    data = {}
    data['locations'] = vrp_data['locations']
    data['time_windows'] = vrp_data['time_windows']
    data['service_times'] = vrp_data['service_times']
    data['num_vehicles'] = vrp_data.get('num_vehicles', 4)
    data['depot'] = 0
    
    # Calculate distance matrix
    data['distance_matrix'] = [
        [int(geodesic(loc1, loc2).miles * 10) for loc2 in data['locations']]
        for loc1 in data['locations']
    ]
    
    return data

def solve_vrp(data):
    """Solve the VRP with time windows."""
    # Create the routing index manager
    manager = pywrapcp.RoutingIndexManager(len(data['locations']),
                                           data['num_vehicles'], data['depot'])

    # Create Routing Model
    routing = pywrapcp.RoutingModel(manager)

    # Create and register a transit callback
    def time_callback(from_index, to_index):
        """Returns the travel time between the two nodes."""
        # Convert from routing variable Index to time matrix NodeIndex
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['distance_matrix'][from_node][to_node] + data['service_times'][from_node]

    transit_callback_index = routing.RegisterTransitCallback(time_callback)

    # Define cost of each arc
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Add Time Windows constraint
    time = 'Time'
    routing.AddDimension(
        transit_callback_index,
        30,  # allow waiting time
        1260,  # maximum time per vehicle
        False,  # Don't force start cumul to zero
        time)
    time_dimension = routing.GetDimensionOrDie(time)

    # Add time window constraints for each location except depot
    for location_idx, time_window in enumerate(data['time_windows']):
        if location_idx == data['depot']:
            continue
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])

    # Add time window constraints for each vehicle start node
    for vehicle_id in range(data['num_vehicles']):
        index = routing.Start(vehicle_id)
        time_dimension.CumulVar(index).SetRange(data['time_windows'][data['depot']][0],
                                                data['time_windows'][data['depot']][1])

    # Instantiate route start and end times to produce feasible times
    for i in range(data['num_vehicles']):
        routing.AddVariableMinimizedByFinalizer(
            time_dimension.CumulVar(routing.Start(i)))
        routing.AddVariableMinimizedByFinalizer(
            time_dimension.CumulVar(routing.End(i)))

    # Setting first solution heuristic
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)

    # Solve the problem
    solution = routing.SolveWithParameters(search_parameters)

    # Return the solution
    if solution:
        return get_solution(data, manager, routing, solution)
    return None

def get_solution(data, manager, routing, solution):
    """Extracts and formats the solution."""
    result = {}
    time_dimension = routing.GetDimensionOrDie('Time')
    total_time = 0
    for vehicle_id in range(data['num_vehicles']):
        index = routing.Start(vehicle_id)
        plan_output = f'Route for vehicle {vehicle_id}:\n'
        route_time = 0
        while not routing.IsEnd(index):
            time_var = time_dimension.CumulVar(index)
            plan_output += f'{manager.IndexToNode(index)} Time({solution.Min(time_var)},{solution.Max(time_var)}) -> '
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            route_time += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
        time_var = time_dimension.CumulVar(index)
        plan_output += f'{manager.IndexToNode(index)} Time({solution.Min(time_var)},{solution.Max(time_var)})\n'
        plan_output += f'Time of the route: {route_time}min\n'
        total_time += route_time
        result[f'vehicle_{vehicle_id}'] = {
            'route': plan_output,
            'time': route_time
        }
    result['total_time'] = total_time
    return result

if __name__ == '__main__':
    # Get VRP data from environment variable
    vrp_data = json.loads(os.environ['VRP_DATA'])
    
    # Solve VRP
    data = create_data_model(vrp_data)
    solution = solve_vrp(data)
    
    # Store solution in S3
    s3.put_object(
        Bucket=VRP_SOLUTIONS_BUCKET,
        Key=f"solution_{os.environ['AWS_BATCH_JOB_ID']}.json",
        Body=json.dumps(solution)
    )

    print(f"Solution stored in S3 bucket: {VRP_SOLUTIONS_BUCKET}")