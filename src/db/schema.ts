import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table linked to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Projects table to organize app data and target project configurations
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  targetApp: text('target_app'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tournament Brackets (Tagged by Region: EMEA, NA, SA, EA and Stage: QD1, QD2)
export const brackets = pgTable('brackets', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique(), // Bracket UUID e.g. 179c9838-85da-11f1-9e79-866f44b823f8
  month: text('month').default('August 2026'),
  region: text('region').notNull(), // Tagged: EMEA, NA, SA, EA
  stage: text('stage').notNull(), // Tagged: QD1, QD2
  stageLabel: text('stage_label'),
  segmentName: text('segment_name'),
  matchCount: integer('match_count').default(0),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Matches Table (Guaranteed unique via matchUuid to prevent duplicates)
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  matchUuid: text('match_uuid').notNull().unique(), // Unique Match UUID
  bracketUuid: text('bracket_uuid').references(() => brackets.uuid, { onDelete: 'cascade' }),
  region: text('region').notNull(), // Tagged: EMEA, NA, SA, EA
  stage: text('stage').notNull(), // Tagged: QD1, QD2
  month: text('month').default('August 2026'),
  roundId: integer('round_id'),
  matchNumber: integer('match_number'),
  format: text('format').default('BO3'),
  team1Name: text('team1_name'),
  team2Name: text('team2_name'),
  team1Score: integer('team1_score').default(0),
  team2Score: integer('team2_score').default(0),
  team1Players: jsonb('team1_players').$type<any[]>(),
  team2Players: jsonb('team2_players').$type<any[]>(),
  winnerName: text('winner_name'),
  isBye: boolean('is_bye').default(false),
  isForfeit: boolean('is_forfeit').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Draft Games Table (Bans, Picks, Maps per game, tagged by region and stage)
export const draftGames = pgTable('draft_games', {
  id: serial('id').primaryKey(),
  draftKey: text('draft_key').notNull().unique(), // e.g. game1-na-qd1-09c8647e
  matchUuid: text('match_uuid').references(() => matches.matchUuid, { onDelete: 'cascade' }),
  gameNum: integer('game_num').notNull(), // 1, 2, 3
  region: text('region').notNull(), // Tagged: EMEA, NA, SA, EA
  stage: text('stage').notNull(), // Tagged: QD1, QD2
  roundId: integer('round_id'),
  mapName: text('map_name'),
  gameMode: text('game_mode'),
  team1Name: text('team1_name'),
  team2Name: text('team2_name'),
  team1Bans: jsonb('team1_bans').$type<string[]>(), // ["CHUCK", "BROCK", "BOLT"]
  team2Bans: jsonb('team2_bans').$type<string[]>(),
  team1Picks: jsonb('team1_picks').$type<string[]>(),
  team2Picks: jsonb('team2_picks').$type<string[]>(),
  team1Players: jsonb('team1_players').$type<any[]>(),
  team2Players: jsonb('team2_players').$type<any[]>(),
  team1PlayerPicks: jsonb('team1_player_picks').$type<any[]>(),
  team2PlayerPicks: jsonb('team2_player_picks').$type<any[]>(),
  team1Won: boolean('team1_won').default(false),
  team2Won: boolean('team2_won').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Generic Data Items / App Records stored safely in PostgreSQL
export const appItems = pgTable('app_items', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').default('general'),
  dataPayload: text('data_payload'), // Clean JSON text format
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Audit / System Logs table
export const dbLogs = pgTable('db_logs', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  details: text('details'),
  executedBy: text('executed_by').default('system'),
  status: text('status').default('success'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  items: many(appItems),
}));

export const appItemsRelations = relations(appItems, ({ one }) => ({
  project: one(projects, {
    fields: [appItems.projectId],
    references: [projects.id],
  }),
}));

export const bracketsRelations = relations(brackets, ({ many }) => ({
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  bracket: one(brackets, {
    fields: [matches.bracketUuid],
    references: [brackets.uuid],
  }),
  draftGames: many(draftGames),
}));

export const draftGamesRelations = relations(draftGames, ({ one }) => ({
  match: one(matches, {
    fields: [draftGames.matchUuid],
    references: [matches.matchUuid],
  }),
}));

