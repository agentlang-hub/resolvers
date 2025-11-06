module box

import "resolver.js" @as br

entity File {
    id String @id,
    name String @optional,
    download_url String @optional,
    modified_at String @optional
}

entity Folder {
    id String @id,
    name String @optional,
    modified_at String @optional,
    url String @optional
}

entity User {
    id String @id,
    email String @optional,
    first_name String @optional,
    last_name String @optional
}

entity CreateUserInput {
    first_name String @optional,
    last_name String @optional,
    email String @optional
}

entity DeleteUserInput {
    id String @optional,
    force Boolean @optional,
    notify Boolean @optional
}

entity FolderContentInput {
    id String @optional,
    marker String @optional
}

entity FolderContent {
    files File @optional,
    folders Folder @optional,
    next_marker String @optional
}

entity FileContent {
    id String @optional,
    name String @optional,
    content String @optional,
    size Number @optional,
    modified_at String @optional
}

resolver box1 [box/File] {
    query br.queryFile,
    update br.updateFile,
    delete br.deleteFile,
    subscribe br.subsFiles
}

resolver box2 [box/Folder] {
    create br.createFolder,
    query br.queryFolder,
    update br.updateFolder,
    delete br.deleteFolder,
    subscribe br.subsFolders
}

resolver box3 [box/User] {
    create br.createUser,
    query br.queryUser,
    update br.updateUser,
    delete br.deleteUser,
    subscribe br.subsUsers
}

resolver box4 [box/CreateUserInput] {
    create br.createUserAction
}

resolver box5 [box/DeleteUserInput] {
    create br.deleteUserAction
}

resolver box6 [box/FolderContentInput] {
    query br.queryFolderContent
}

resolver box7 [box/FolderContent] {
    query br.getFolderContent
}

resolver box8 [box/FileContent] {
    query br.queryFileContent
}

workflow SyncLocalFile {
    {agentlang.files/File {filename? SyncLocalFile.fileName}}
    @as [f]
    if (f) {
        br.uploadFile(f.filename, SyncLocalFile.uploadName)
    }
}

workflow SyncRemoteFile {
    br.syncRemoteFile(SyncRemoteFile.fileId, SyncRemoteFile.fileName) @as f
    if (f) {
        agentlang.files/CreateFile {
            id f.id,
            filename br.getFileUniqueName(SyncRemoteFile.fileName, f.id, f.name),
            originalFilename f.name,
            uploadedAt now(),
            mimetype "application/octet-stream"
        }
    } else {
        "Failed to sync remote file"
    }
}

workflow ListFiles {
    {agentlang.files/File? {}}}

