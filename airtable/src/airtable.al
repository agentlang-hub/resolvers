module airtable

import "resolver.js" @as ar

entity Base {
    id String @id,
    name String @optional,
    permission_level String @optional
}

entity Table {
    id String @id,
    name String @optional,
    description String @optional,
    base_id String @optional
}

entity Field {
    id String @id,
    name String @optional,
    type String @optional,
    description String @optional,
    table_id String @optional
}

entity Record {
    id String @id,
    created_time String @optional,
    fields Any @optional,
    table_id String @optional,
    base_id String @optional
}

entity CreateRecordInput {
    fields Any @optional,
    table_id String @optional,
    base_id String @optional
}

entity CreateRecordOutput {
    id String @optional,
    created_time String @optional,
    fields Any @optional
}

entity UpdateRecordInput {
    id String @optional,
    fields Any @optional,
    table_id String @optional,
    base_id String @optional
}

entity AirtableMetadata {
    base_ids_to_sync String @optional,
    api_key String @optional,
    base_url String @optional
}

resolver airtable1 [airtable/Base] {
    query ar.queryBase,
    subscribe ar.subsBases
}

resolver airtable2 [airtable/Table] {
    query ar.queryTable,
    subscribe ar.subsTables
}

resolver airtable3 [airtable/Field] {
    query ar.queryField,
    subscribe ar.subsFields
}

resolver airtable4 [airtable/Record] {
    create ar.createRecord,
    query ar.queryRecord,
    update ar.updateRecord,
    delete ar.deleteRecord,
    subscribe ar.subsRecords
}

resolver airtable5 [airtable/CreateRecordInput] {
    create ar.createRecordAction
}

resolver airtable6 [airtable/CreateRecordOutput] {
    query ar.queryCreateRecord
}

resolver airtable7 [airtable/UpdateRecordInput] {
    update ar.updateRecordAction
}

