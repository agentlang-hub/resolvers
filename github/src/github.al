module github

import "resolver.js" @as ghr

entity Issue {
    id String @id,
    owner String @optional,
    repo String @optional,
    issue_number Number @optional,
    title String @optional,
    author String @optional,
    author_id String @optional,
    state String @optional,
    date_created String @optional,
    date_last_modified String @optional,
    body String @optional
}

entity Repository {
    id Number @id,
    owner String @optional,
    name String @optional,
    full_name String @optional,
    description String @optional,
    url String @optional,
    date_created String @optional,
    date_last_modified String @optional
}

entity File {
    id String @id,
    name String @optional,
    url String @optional,
    last_modified_date String @optional
}

entity WriteFileInput {
    owner String @optional,
    repo String @optional,
    path String @optional,
    message String @optional,
    content String @optional,
    sha String @optional
}

entity WriteFileOutput {
    url String @optional,
    status String @optional,
    sha String @optional
}

entity RepoInput {
    owner String @optional,
    repo String @optional,
    branch String @optional
}

entity Organization {
    id Number @id,
    login String @optional,
    name String @optional,
    url String @optional,
    description String @optional
}

entity User {
    id Number @id,
    login String @optional,
    name String @optional,
    url String @optional,
    email String @optional
}

resolver github1 [github/Issue] {
    create ghr.createIssue,
    query ghr.queryIssue,
    update ghr.updateIssue,
    delete ghr.deleteIssue,
    subscribe ghr.subsIssues
}

resolver github2 [github/Repository] {
    create ghr.createRepository,
    query ghr.queryRepository,
    update ghr.updateRepository,
    delete ghr.deleteRepository,
    subscribe ghr.subsRepositories
}

resolver github3 [github/File] {
    query ghr.queryFile,
    update ghr.updateFile,
    delete ghr.deleteFile
}

resolver github4 [github/WriteFileInput] {
    create ghr.writeFile
}

resolver github5 [github/WriteFileOutput] {
    query ghr.queryWriteFile
}

resolver github6 [github/RepoInput] {
    query ghr.queryRepoFiles
}

resolver github7 [github/Organization] {
    query ghr.queryOrganizations
}

resolver github8 [github/User] {
    query ghr.queryUser
}
