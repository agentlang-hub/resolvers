module zoom

import "resolver.js" @as zr

entity User {
    id String @id,
    email String @optional,
    first_name String @optional,
    last_name String @optional,
    display_name String @optional,
    type Number @optional,
    role_name String @optional,
    pmi Number @optional,
    use_pmi Boolean @optional,
    personal_meeting_url String @optional,
    timezone String @optional,
    verified Number @optional,
    dept String @optional,
    created_at String @optional,
    last_login_time String @optional,
    last_client_version String @optional,
    language String @optional,
    phone_country String @optional,
    phone_number String @optional,
    status String @optional,
    job_title String @optional,
    location String @optional,
    login_types Any @optional,
    role_id String @optional,
    account_id String @optional,
    account_number Number @optional,
    account_type String @optional,
    jid String @optional,
    group_ids Any @optional,
    im_group_ids Any @optional,
    user_created_at String @optional,
    properties Map @optional,
    createdAt String @optional,
    updatedAt String @optional
}

entity Meeting {
    id Number @id,
    uuid String @optional,
    host_id String @optional,
    host_email String @optional,
    assistant_id String @optional,
    topic String @optional,
    type Number @optional,
    status String @optional,
    start_time String @optional,
    duration Number @optional,
    timezone String @optional,
    created_at String @optional,
    start_url String @optional,
    join_url String @optional,
    password String @optional,
    h323_password String @optional,
    pstn_password String @optional,
    encrypted_password String @optional,
    settings Map @optional,
    agenda String @optional,
    recurrence Map @optional,
    occurrences Any @optional,
    tracking_fields Any @optional,
    occurrences_count Number @optional,
    creation_source String @optional,
    pre_schedule Boolean @optional,
    properties Map @optional,
    createdAt String @optional,
    updatedAt String @optional
}

entity Webinar {
    id Number @id,
    uuid String @optional,
    host_id String @optional,
    host_email String @optional,
    topic String @optional,
    type Number @optional,
    start_time String @optional,
    duration Number @optional,
    timezone String @optional,
    created_at String @optional,
    join_url String @optional,
    agenda String @optional,
    password String @optional,
    h323_password String @optional,
    pstn_password String @optional,
    encrypted_password String @optional,
    settings Map @optional,
    recurrence Map @optional,
    occurrences Any @optional,
    tracking_fields Any @optional,
    occurrences_count Number @optional,
    registration_url String @optional,
    properties Map @optional,
    createdAt String @optional,
    updatedAt String @optional
}

entity Recording {
    id Number @id,
    uuid String @optional,
    account_id String @optional,
    host_id String @optional,
    host_email String @optional,
    topic String @optional,
    type Number @optional,
    start_time String @optional,
    timezone String @optional,
    duration Number @optional,
    total_size Number @optional,
    recording_count Number @optional,
    share_url String @optional,
    recording_files Any @optional,
    password String @optional,
    recording_play_passcode String @optional,
    properties Map @optional,
    createdAt String @optional,
    updatedAt String @optional
}

resolver zoom1 [zoom/User] {
    create zr.createUser,
    query zr.queryUser,
    update zr.updateUser,
    delete zr.deleteUser
}

resolver zoom2 [zoom/Meeting] {
    create zr.createMeeting,
    query zr.queryMeeting,
    update zr.updateMeeting,
    delete zr.deleteMeeting
}

resolver zoom3 [zoom/Webinar] {
    create zr.createWebinar,
    query zr.queryWebinar,
    update zr.updateWebinar,
    delete zr.deleteWebinar
}

resolver zoom4 [zoom/Recording] {
    query zr.queryRecording,
    delete zr.deleteRecording
}

