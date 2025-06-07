"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionType = exports.TaskType = exports.UserRole = exports.AgeRange = exports.EnglishLevel = void 0;
var EnglishLevel;
(function (EnglishLevel) {
    EnglishLevel["BEGINNER"] = "beginner";
    EnglishLevel["INTERMEDIATE"] = "intermediate";
    EnglishLevel["ADVANCED"] = "advanced";
})(EnglishLevel || (exports.EnglishLevel = EnglishLevel = {}));
// טיפוס לקביעת קבוצת גיל
var AgeRange;
(function (AgeRange) {
    AgeRange["AGE_0_17"] = "under_18";
    AgeRange["AGE_18_24"] = "18-24";
    AgeRange["AGE_25_34"] = "25-34";
    AgeRange["AGE_35_44"] = "35-44";
    AgeRange["AGE_45_54"] = "45-54";
    AgeRange["AGE_55_64"] = "55-64";
    AgeRange["AGE_65_PLUS"] = "65+";
})(AgeRange || (exports.AgeRange = AgeRange = {}));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var TaskType;
(function (TaskType) {
    TaskType["FLASHCARD"] = "flashcard";
    TaskType["POST"] = "post";
    TaskType["CONVERSATION"] = "conversation";
    TaskType["QUIZ"] = "quiz";
})(TaskType || (exports.TaskType = TaskType = {}));
var SessionType;
(function (SessionType) {
    SessionType["PRESS_CONFERENCE"] = "pressConference";
    SessionType["DIPLOMATIC_CONVERSATION"] = "diplomaticConversation";
    SessionType["DEBATE_PRESENTATION"] = "debatePresentation";
    SessionType["CAMPUS_ADVOCACY"] = "campusAdvocacy";
    SessionType["PRONUNCIATION"] = "pronunciation";
    SessionType["VOCABULARY_PRACTICE"] = "vocabularyPractice";
    SessionType["GRAMMAR_PRACTICE"] = "grammarPractice";
    SessionType["LISTENING_COMPREHENSION"] = "listeningComprehension";
    SessionType["conversation"] = "conversation";
})(SessionType || (exports.SessionType = SessionType = {}));
