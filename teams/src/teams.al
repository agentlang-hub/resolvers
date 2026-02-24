module teams

import "resolver.js" @as t

// --- Resource entities ---

entity Team {
    id String,
    displayName String,
    description String @optional
}

entity Channel {
    id String,
    displayName String,
    membershipType String @optional
}

entity Message {
    id String,
    body Any @optional,
    from Any @optional,
    createdDateTime String @optional
}

// --- Operations (event + workflow) ---

event joinedTeams {
    @meta {"documentation": "List Microsoft Teams the authenticated user has joined.

{teams/joinedTeams {}} @as myTeams

Returns a list of Team entities."}
}

workflow joinedTeams {
    await t.joinedTeams()
}

event listChannels {
    teamId String,
    @meta {"documentation": "List channels in a Microsoft Teams team.

{teams/listChannels {teamId \"<team-id>\"}} @as channels

Returns a list of Channel entities."}
}

workflow listChannels {
    await t.listChannels(listChannels.teamId)
}

event listThreadReplies {
    teamId String,
    channelId String,
    messageId String,
    @meta {"documentation": "Get replies to a message thread in a channel.

{teams/listThreadReplies {teamId \"<team-id>\", channelId \"<channel-id>\", messageId \"<msg-id>\"}} @as replies

Returns a list of Message entities."}
}

workflow listThreadReplies {
    await t.listThreadReplies(listThreadReplies.teamId, listThreadReplies.channelId, listThreadReplies.messageId)
}

event sendChannelMessage {
    teamId String,
    channelId String,
    message String,
    contentType String @optional,
    @meta {"documentation": "Send a message to a Microsoft Teams channel.

{teams/sendChannelMessage {teamId \"<team-id>\", channelId \"<channel-id>\", message \"hello\"}} @as response

Optional contentType: \"text\" (default) or \"html\". Returns the message id."}
}

workflow sendChannelMessage {
    await t.sendChannelMessage(sendChannelMessage.teamId, sendChannelMessage.channelId, sendChannelMessage.message, sendChannelMessage.contentType)
}

event replyToThread {
    teamId String,
    channelId String,
    messageId String,
    message String,
    contentType String @optional,
    @meta {"documentation": "Reply to a thread in a Microsoft Teams channel.

{teams/replyToThread {teamId \"<team-id>\", channelId \"<channel-id>\", messageId \"<msg-id>\", message \"reply\"}} @as response

Optional contentType: \"text\" (default) or \"html\". Returns the reply id."}
}

workflow replyToThread {
    await t.replyToThread(replyToThread.teamId, replyToThread.channelId, replyToThread.messageId, replyToThread.message, replyToThread.contentType)
}

event sendDirectMessage {
    userId String,
    message String,
    contentType String @optional,
    @meta {"documentation": "Send a 1:1 direct message to a Microsoft Teams user.

{teams/sendDirectMessage {userId \"<user-id-or-email>\", message \"hello\"}} @as response

Creates a oneOnOne chat if needed. Optional contentType: \"text\" (default) or \"html\". Returns the message id."}
}

workflow sendDirectMessage {
    await t.sendDirectMessage(sendDirectMessage.userId, sendDirectMessage.message, sendDirectMessage.contentType)
}
