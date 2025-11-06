module googledrive

import "resolver.js" @as gdr

entity Document {
    id String @id,
    url String @optional,
    title String @optional,
    mime_type String @optional,
    updated_at String @optional
}

entity Folder {
    id String @id,
    url String @optional,
    title String @optional,
    mime_type String @optional,
    updated_at String @optional
}

entity File {
    id String @id,
    name String @optional,
    mime_type String @optional,
    parents String @optional,
    modified_time String @optional,
    created_time String @optional,
    web_view_link String @optional,
    kind String @optional
}

entity Drive {
    id String @id,
    name String @optional,
    kind String @optional,
    created_time String @optional,
    hidden Boolean @optional
}

entity UploadFileInput {
    content String @optional,
    name String @optional,
    mime_type String @optional,
    folder_id String @optional,
    description String @optional,
    is_base64 Boolean @optional
}

entity FolderContentInput {
    id String @optional,
    cursor String @optional
}

entity FolderContent {
    files File @optional,
    folders File @optional,
    next_cursor String @optional
}

entity FileContent {
    id String @optional,
    name String @optional,
    content String @optional,
    size Number @optional,
    modified_time String @optional
}

entity LocalUploadInput {
    local_file_path String @optional,
    file_name String @optional,
    folder_id String @optional
}

resolver googledrive1 [googledrive/Document] {
    query gdr.queryDocument,
    update gdr.updateDocument,
    delete gdr.deleteDocument
    // subscribe gdr.subsDocuments
}

resolver googledrive2 [googledrive/Folder] {
    create gdr.createFolder,
    query gdr.queryFolder,
    update gdr.updateFolder,
    delete gdr.deleteFolder
    // subscribe gdr.subsFolders
}

resolver googledrive3 [googledrive/File] {
    query gdr.queryFile,
    update gdr.updateFile,
    delete gdr.deleteFile
}

resolver googledrive4 [googledrive/Drive] {
    query gdr.queryDrive
}

resolver googledrive5 [googledrive/UploadFileInput] {
    create gdr.uploadFile
}

resolver googledrive6 [googledrive/FolderContentInput] {
    query gdr.queryFolderContent
}

resolver googledrive7 [googledrive/FolderContent] {
    query gdr.getFolderContent
}

resolver googledrive8 [googledrive/FileContent] {
    query gdr.queryFileContent
}

resolver googledrive9 [googledrive/LocalUploadInput] {
    create gdr.uploadLocalFile
}

workflow SyncLocalFile {
    {agentlang.files/File {filename? SyncLocalFile.fileName}}
    @as [f]
    if (f) {
        gdr.uploadLocalFile(f.filename, SyncLocalFile.uploadName)
    }
}

workflow SyncRemoteFile {
    gdr.syncRemoteFile(SyncRemoteFile.sourceFileId, SyncRemoteFile.targetFileName) @as f
    if (f) {
        agentlang.files/CreateFile {
            id f.id,
            filename gdr.getFileUniqueName(SyncRemoteFile.targetFileName, f.id, f.name),
            originalFilename f.name,
            uploadedAt now(),
            mimetype "application/octet-stream"
        }
    } else {
        "Failed to sync remote file"
    }
}

