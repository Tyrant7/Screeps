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

const directions = {
    [RIGHT]: { x: 1, y: 0 },
    [BOTTOM_RIGHT]: { x: 1, y: 1 },
    [BOTTOM]: { x: 0, y: 1 },
    [BOTTOM_LEFT]: { x: -1, y: 1 },
    [LEFT]: { x: -1, y: -1 },
    [TOP_LEFT]: { x: -1, y: -1 },
    [TOP]: { x: 0, y: -1 },
    [TOP_RIGHT]: { x: 1, y: -1 }
};

// TODO
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

function properModulus(x, y) {
    return x < 0 ? y - (-x % y) : x % y;
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
    const smartPath = getSmartPath(this.pos, targets);
    this.memory.smartPath = smartPath;
}

// Generates a smart path to a given target
Creep.prototype.getSmartPathToTarget = function(target, range = 1) {
    const smartPath = getSmartPath(this.pos, { pos: target.pos, range: range });
    this.memory.smartPath = smartPath;
}

// Follows a generated smart path
// Returns -1 if no smart path exists
Creep.prototype.followSmartPath = function() {
    if (!this.memory.smartPath) {
        return -1;
    }

    // All creeps are active while moving
    this.setPathStatus(CONSTANTS.pathStatus.active);
  
    const nextStep = this.memory.smartPath.path[0];
    if (this.move(nextStep) === OK) {
        this.memory.smartPath.path.shift();

        // Swap with any blockers, as long as they aren't static
        const blocker = getPosInDir(nextStep).lookFor(LOOK_CREEPS)[0];
        if (blocker && blocker.memory && blocker.memory.pathStatus !== CONSTANTS.pathStatus.static) {
            blocker.requestSwap(nextStep);
        }

        // If we have no more items left in our path, we are now passive, unless static
        if (this.memory.smartPath.path.length == 0 &&
            this.memory.pathStatus === CONSTANTS.pathStatus.active) {
            this.setPathStatus(CONSTANTS.pathStatus.passive);
        }
    }
}

Creep.prototype.smartMoveTo = function(target) {
    const smartPath = this.memory.smartPath;
    if (!smartPath || smartPath.path.length == 0 || !smartPath.target.inRangeTo(target, 1)) {
        getSmartPathToTarget(target);
    }
    this.followSmartPath();
}

// Sets a path status for this creep, and flags regeneration of the cost matrix for its room
// if this creep is or was static
Creep.prototype.setPathStatus = function(pathStatus) {
    this.memory.pathStatus = pathStatus;
}


// Gets a position in the specified direction of this room position
// Wraps around to neighbouring rooms
RoomPosition.prototype.getPosInDir = function(dir) {

    let x = properModulus(this.x + directions[dir].x, ROOM_WIDTH);
    let y = properModulus(this.y + directions[dir].y, ROOM_HEIGHT);

    // TODO: Fix jank asf code here
    return new RoomPosition(x, y, x > 0 && y > 0 ? this.roomName : Game.map.describeExits(this.roomName)[dir] || this.roomName);
}


// Generates a new cost matrix for the specified room and caches it
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
    cachedCostMatrices[room.name] = { matrix: matrix, tick: Game.time };
}


// Returns a cached cost matrix if one exists, otherwise generates one
function getCostMatrix(roomName) {
    if (cachedCostMatrices[roomName].tick === Game.time) {
        return cachedCostMatrices[roomName];
    }
    return generateCostMatrix(Game.rooms[roomName]);
}


// Returns an array of directions from start (RoomPosition) to the closest goal (RoomPosition)
// In the form
// { path: DIRECTION constants, targetChosen: RoomPositon }
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
    directions.push(start.getDirectionTo(path[0]));

    // Path directions from first point to the last, excluding the last since it has nowhere to go
    for (let i = 0; i < path.length - 2; i++) {
        directions.push(path[i].getDirectionTo(path[i + 1]));
    }
    return { path: directions, target: path.at(-1) };
}

module.exports = generateCostMatrix;