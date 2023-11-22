// List of cachedCostMatrices for this tick
// Stored in the form
// { roomName [string]: PathFinder.CostMatrix }
var cachedCostMatrices = {}

// Set of room names to regenerate the cost matrix for at the end of this tick
var roomsToRegenerate = new Set();

// Regenerate our matrices every 100 ticks no matter what
const MATRIX_REMAKE_INTERVAL = 100;

const ROOM_WIDTH = 50;
const ROOM_HEIGHT = 50;

const ROAD_COST = 1;

const IMMOVABLE = 255;

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

// Generate cost matrix once per room; regenerate when one of the following occurs:
// When a static creep moves
// When a static creep dies
// When a structure is built
// When a structure is destroyed


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

// Follows a previously generated smart path
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

        console.log(nextStep);

        // Swap with any blockers, as long as they aren't static
        const blocker = this.pos.getPosInDir(nextStep).lookFor(LOOK_CREEPS)[0];
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

// Follows an existing smartPath if one exists matching the target, otherwise generates one
Creep.prototype.smartMoveTo = function(target) {

    if (!target) {
        return;
    }

    // Make sure this is the position of the target
    if (!(target instanceof RoomPosition)) {
        if (target.pos) {
            target = target.pos;
        }
        else {
            return;
        }
    }

    const smartPath = this.memory.smartPath;
    if (!smartPath || smartPath.path.length == 0 || 
        !smartPath.target || !smartPath.target.inRangeTo(target, 1)) {
        this.getSmartPathToTarget(target);
    }
    this.followSmartPath();
}

// Sets a path status for this creep, and flags regeneration of the cost matrix for its room
// if this creep is or was static
Creep.prototype.setPathStatus = function(pathStatus) {

    // Creeps is static and about to die, we can regenerate this room's cost matrix
    if (this.ticksToLive <= 1 &&
        this.memory.pathStatus === CONSTANTS.pathStatus.static) {
        roomsToRegenerate.add(this.room.name);
    }

    // Don't force regenerations if they don't need to happen
    if (this.memory.pathStatus === pathStatus) {
        return;
    }

    // Regenerate this matrix if this creep is going to/from a static path state
    if (this.memory.pathStatus === CONSTANTS.pathStatus.static ||
        pathStatus === CONSTANTS.pathStatus.static) {
            roomsToRegenerate.add(this.room.name);
        } 

    this.memory.pathStatus = pathStatus;
}

// Thin wrapper around creating construction sites through code
const createSite = RoomPosition.prototype.createConstructionSite;
RoomPosition.prototype.createConstructionSite = function(structureType, name) {

    // Log this room to be regenerated
    roomsToRegenerate.add(this.roomName);

    // Then do default site placement behaviour
    return createSite.call(this, structureType, name);
}


// Gets a position in the specified direction of this room position
// Wraps around to neighbouring rooms
RoomPosition.prototype.getPosInDir = function(dir) {

    console.log(directions[dir]);
    let x = properModulus(this.x + directions[dir].x, ROOM_WIDTH);
    let y = properModulus(this.y + directions[dir].y, ROOM_HEIGHT);

    // TODO: Fix jank asf code here
    return new RoomPosition(x, y, x > 0 && y > 0 ? this.roomName : Game.map.describeExits(this.roomName)[dir] || this.roomName);
}


// First searches through all of our rooms and figures out which need to have changed structures
// Then, for all rooms in roomsToRegenerate, regenerates cost matrices, then recalculates paths for all creeps
function regenerateAppropriateRooms() {

    // Figure out which rooms have changed
    let i = -1;
    for (let roomName in Game.rooms) {
        // Force rooms to regenerate every so often, 
        // but stagger regeneration of rooms so as not to regenerate all of them at once
        i++;
        if (Game.time % MATRIX_REMAKE_INTERVAL === i % MATRIX_REMAKE_INTERVAL) {
            roomsToRegenerate.add(roomName);
            continue;
        }

        // Get all rooms with my creeps or structures in them, and verify that they have the same number of structures as last tick
        // No need to verify creep counts since static creeps will add rooms themselves when changing status
        // Comparing only counts does come with the strange edge case of if a structure is destroyed at the same time as another is built,
        // But this should sort itself out since we forcefully regenerate every so often
        const structureCount = Game.rooms[roomName].find(FIND_STRUCTURES).length;
        if (structureCount !== cachedCostMatrices[roomName].structureCount) {
            roomsToRegenerate.add(roomName);
        }
    }

    // Rooms
    for (let roomName of roomsToRegenerate) {
        const room = Game.rooms[roomName];

        // First regenerate the cost matrix
        generateCostMatrix(room);

        // Then recalculate all paths
        room.find(FIND_MY_CREEPS, { 
            filter: (creep) => {
                return creep.memory && creep.memory.smartPath && creep.memory.pathStatus === CONSTANTS.pathStatus.active;
        }}).forEach((creep) => {
            creep.getSmartPathToTarget(creep.smartPath.target);
        });
    }
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
    cachedCostMatrices[room.name] = { matrix: matrix, tick: Game.time, structureCount: structures.length };
    return cachedCostMatrices[room.name].matrix;
}


// Returns a cached cost matrix if one exists, otherwise generates one
function getCostMatrix(roomName) {

    console.log("getting cost matrix");

    if (cachedCostMatrices[roomName] && 
        cachedCostMatrices[roomName].tick === Game.time) {

        console.log("returning cached matrix");
        console.log(cachedCostMatrices[roomName]);

        return cachedCostMatrices[roomName].matrix;
    }

    console.log("creating new matrix");

    console.log(cachedCostMatrices[roomName]);

    // console.log(generateCostMatrix(Game.rooms[roomName]).matrix);
    return generateCostMatrix(Game.rooms[roomName]).matrix;
}


// Returns an array of directions from start (RoomPosition) to the closest goal (RoomPosition)
// In the form
// { path: DIRECTION constants, targetChosen: RoomPositon }
function getSmartPath(start, goals) {

    console.log("get");
    goals = new RoomPosition(0, 9);

    // This will get us our path as a list of RoomPositions
    let path = PathFinder.search(start, goals, {
        // Default costs for walkable terrain
        plainCost: 2,
        swampCost: 10,

        roomCallback: getCostMatrix
    });

    if (path.length == 0) {
        return { path: null, target: null };
    }

    // Convert our list of positions into directions, and store our initial direction
    let directions = [];
    directions.push(start.getDirectionTo(path[0]));

    // Path directions from first point to the last, excluding the last since it has nowhere to go
    for (let i = 0; i < path.length - 2; i++) {
        directions.push(path[i].getDirectionTo(path[i + 1]));
    }
    return { path: directions, target: path.at(-1) };
}

module.exports = regenerateAppropriateRooms;