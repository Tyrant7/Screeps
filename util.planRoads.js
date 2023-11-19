var utilPlanRoads = {
    
    run: function(creep, from, to) {
        
        // Initialize the path status
        if (!creep.memory.pathStatus) {
            creep.memory.pathStatus = "from";
        }
        
        // Walk until we've reached our starting point
        if (creep.memory.pathStatus == "from") {
            creep.moveTo(from, {visualizePathStyle: {stroke: "ffaa00"}});
            if (creep.pos.inRangeTo(from, 1)) {
                creep.memory.pathStatus = "to";
            }
        }
        // Walk until we've reached out end point, placing construction sites for roads the way
        else if (creep.memory.pathStatus == "to") {
            creep.moveTo(to, {visualizePathStyle: {stroke: "ffaa00"}});
            if (!creep.pos.lookFor(STRUCTURE_ROAD)) {
                creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_ROAD)
            }
            if (creep.pos.inRangeTo(to, 1)) {
                creep.memory.pathStatus = "finished";
                return true;
            }
        }
        return false;
    }
};

module.exports = utilPlanRoads;