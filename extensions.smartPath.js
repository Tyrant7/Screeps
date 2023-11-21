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

// Generate cost matrix once per room; regenerate when one of the following occurs:
// When a static creep moves
// When a static creep dies
// When a structure is built
// When a structure is destroyed

// Use regex to filter out relevant events from the getEventLog property of the room
// -> build events where a construction site was placed or road was completed
// -> destroy events for structure
// -> death events for creeps where the creep was static
// -> when a creep's status is set to static

function invertDirection(direction) {
    const newDir = direction - 4;
    return newDir < 1 ? newDir + 8 : newDir;
}

Creep.prototype.requestSwap = function (target) {
    const swapDir = this.getDirectionTo(target);
    this.move(swapDir);

    // Make sure to add this step back to the path of the creep so it doesn't offset the path
    if (this.memory.pathStatus === CONSTANTS.pathStatus.active &&
        this.memory.smartPath) {
        this.smartPath.push(invertDirection(swapDir));
    }
}

// Generates a smart path to the closest target in the room that fits the criteria and saves it to creep memory
Creep.prototype.getSmartPath = function(FIND, customFilter, range = 1) { 
    const targets = _.map(this.room.find(FIND, { filter: customFilter }), function(find) {
        return { pos: find.pos, range: range };
    });
    this.memory.smartPath = getSmartPath(this.pos, targets);
}

// Generates a smart path to a given target
Creep.prototype.getSmartPathToTarget = function(target, range = 1) {
    this.memory.smartPath = getSmartPath(this.pos, { pos: target.pos, range: range });
}

// Follows a generated smart path
Creep.prototype.followSmartPath = function() {
    if (!this.memory.smartPath) {
        return -1;
    }

    // All creeps are active while moving
    this.memory.pathStatus = CONSTANTS.pathStatus.active;

    if (this.move(this.memory.smartPath[0]) === OK) {
        this.memory.smartPath.shift();

        // If we have no more items left in our path, we are now passive, unless static
        if (this.memory.smartPath.length == 0 &&
            this.memory.pathStatus === CONSTANTS.pathStatus.active) {
            this.memory.pathStatus = CONSTANTS.pathStatus.passive;
        }
    }
}

// Sets a path status for this creep, and flags regeneration of the cost matrix for its room
// if this creep is or was static
Creep.prototype.setPathStatus = function(pathStatus) {
    if (this.memory.pathStatus === CONSTANTS.pathStatus.static ||
        pathStatus === CONSTANTS.pathStatus.static) {
        logRegeneration(this.room);
    }
    this.memory.pathStatus = pathStatus;
}

// Logs a room to regenerate the cost matrix for at the end of the tick
function logRegeneration(room) {
    return;
}


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
    const creeps = room.find(FIND_MY_CREEPS);
    for (let creep of creeps) {
        if (creep.memory.pathStatus === CONSTANTS.pathStatus.static) {
            matrix.set(creep.pos.x, creep.pos.y, IMMOVABLE);
        }
    }

    // Add this matrix to the cache
    cachedCostMatrices[room.name] = matrix;
    return matrix;
}


// Returns a cached cost matrix if one exists, otherwise generates one
function getCostMatrix(roomName) {
    if (cachedCostMatrices[roomName]) {
        return cachedCostMatrices[roomName];
    }
    return generateCostMatrix(Game.rooms[roomName]);
}


// Returns an array of directions from start (RoomPosition) to the closest goal (RoomPosition)
function getSmartPath(start, goals) {

    // This will get us our path as a list of RoomPositions
    let path = PathFinder.search(start, goals, {
        // Default costs for walkable terrain
        plainCost: 2,
        swampCost: 10,

        roomCallback: getCostMatrix(roomName)
    });

    // Convert our list of positions into directions, and store our initial direction
    let directions = [];
    directions.push(start.getDirectionTo(point[0]));

    // Path directions from first point to the last, excluding the last since it has nowhere to go
    for (let i = 0; i < path.length - 2; i++) {
        directions.push(path[i].getDirectionTo(path[i + 1]));
    }
    return directions;
}

module.exports = generateCostMatrix;