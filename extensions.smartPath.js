// List of cachedCostMatrices for this tick
// Stored in the form
// { roomName [string]: PathFinder.CostMatrix }
var cachedCostMatrices = {}

ROOM_WIDTH = 50;
ROOM_HEIGHT = 50;

PLAIN_COST = 2;
SWAMP_COST = 10;
ROAD_COST = 1;

IMMOVABLE = 255;

CREEP_PATH_ACTIVE = "active";
CREEP_PATH_STATIC = "static";

function generateCostMatrix(room) {

    // Clear the existing cached matrix for this room, if one exists
    if (cachedCostMatrices[room.name]) {
        cachedCostMatrices[room.name] = null;
    }

    // Initalize a new matrix with structure costs
    let matrix = new PathFinder.CostMatrix();
    const structures = room.find(FIND_STRUCTURES);
    for (let structure of structures) {
        if (structure.structureType === STRUCTURE_ROAD) {
            matrix.set(structure.pos.x, structure.pos.y, ROAD_COST)
        }
        else if (structure.structureType !== STRUCTURE_RAMPART && 
                 structure.structureType !== STRUCTURE_CONTAINER) {
            matrix.set(structure.pos.x, structure.pos.y, IMMOVABLE);
        }
    }

    // Add immovable tiles where static creeps appear
    const creeps = room.find(FIND_CREEPS);
    for (let creep of creeps) {
        if (creep.memory.pathStatus === CREEP_PATH_STATIC) {
            matrix.set(creep.pos.x, cree.pos.y, IMMOVABLE);
        }
    }

    // Add this matrix to the cache
    cachedCostMatrices[room.name] = matrix;
    return matrix;
}

// Returns a cached cost matrix if one exists, otherwise generates one
function getCachedCostMatrix(roomName) {
    if (cachedCostMatrices[roomName]) {
        return cachedCostMatrices[roomName];
    }
    return generateCostMatrix(Game.rooms[roomName]);
}

// Returns an array of directions from start (RoomPosition) to the closest goal (RoomPosition)
function getSmartPath(start, goals) {

    // This will get us our path as a list of RoomPositions
    let path = PathFinder.search( start, goals, {
        // Default costs for walkable terrain
        plainCost: 2,
        swampCost: 10,

        roomCallback: getCachedCostMatrix(roomName)
    });

    // Convert our list of positions into directions, and store our initial direction
    let directions = [];
    directions.push(start.getDirectionTo(point[0]));

    // Path directions from first point to the last, excluding the last since it has nowhere to go
    for (let i = 0; i < path.length - 2; i++) {
        directions.push(path[i].getDirectionTo(path[i+1]));
    }
    return directions;
}

Creep.prototype.requestSwap = function(target) {
    const swapDir = this.getDirectionTo(target);
    this.move(swapDir);
}