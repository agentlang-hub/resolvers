module servicenow

import "resolver.js" @as r

entity incident {
    sys_id String @id,
    status String @optional,
    data Any @optional,
    category String @optional,
    ai_status String @optional,
    ai_processor String @optional,
    requires_human Boolean @optional,
    ai_reason String @optional,
    resolution String @optional
}

entity task {
    sys_id String @id,
    status String @optional,
    data Any @optional
}

event assignIncident {
    sys_id String,
    user Email
}

workflow assignIncident {
    r.assignIncident(assignIncident.sys_id, assignIncident.user)
}

event assignTask {
    sys_id String,
    user Email
}

workflow assignTask {
    r.assignTask(assignTask.sys_id, assignTask.user)
}

workflow getIncidents {
    {incident? {}}
}

workflow getTasks {
    {task? {}}
}

workflow getManagerUser {
    r.getManagerUser()
}

resolver servicenowincident [servicenow/incident] {
    update r.updateInstance,
    query r.queryInstancesIncidents,
    subscribe r.subsIncidents
}

resolver servicenowtask [servicenow/task] {
    update r.updateInstance,
    query r.queryInstancesTasks,
    subscribe r.subsTasks
}
