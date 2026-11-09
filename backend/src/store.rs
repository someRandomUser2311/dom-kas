//! Learner progress in SQLite. Learners are anonymous: the browser keeps a
//! random learner id and sends it as `X-Learner`.

use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;

pub struct Store {
    conn: Mutex<Connection>,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).ok();
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS learners (
               id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT (datetime('now')));
             CREATE TABLE IF NOT EXISTS progress (
               learner TEXT PRIMARY KEY REFERENCES learners(id), data TEXT NOT NULL, updated TEXT NOT NULL DEFAULT (datetime('now')));
             CREATE TABLE IF NOT EXISTS attempts (
               id INTEGER PRIMARY KEY AUTOINCREMENT, learner TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
               score INTEGER NOT NULL, passed INTEGER NOT NULL, created TEXT NOT NULL DEFAULT (datetime('now')));",
        )?;
        Ok(Store { conn: Mutex::new(conn) })
    }

    pub fn create_learner(&self, name: &str) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn.lock().unwrap().execute("INSERT INTO learners (id, name) VALUES (?1, ?2)", params![id, name])?;
        Ok(id)
    }

    pub fn learner_exists(&self, id: &str) -> Result<bool> {
        let c = self.conn.lock().unwrap();
        Ok(c.query_row("SELECT 1 FROM learners WHERE id = ?1", params![id], |_| Ok(())).optional()?.is_some())
    }

    pub fn get_progress(&self, id: &str) -> Result<Option<String>> {
        let c = self.conn.lock().unwrap();
        Ok(c.query_row("SELECT data FROM progress WHERE learner = ?1", params![id], |r| r.get(0)).optional()?)
    }

    pub fn put_progress(&self, id: &str, data: &str) -> Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO progress (learner, data, updated) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(learner) DO UPDATE SET data = excluded.data, updated = excluded.updated",
            params![id, data],
        )?;
        Ok(())
    }

    pub fn record_attempt(&self, learner: &str, kind: &str, r: &str, score: u32, passed: bool) -> Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO attempts (learner, kind, ref, score, passed) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![learner, kind, r, score, passed as i32],
        )?;
        Ok(())
    }

    pub fn attempts(&self, learner: &str) -> Result<Vec<(String, String, u32, bool, String)>> {
        let c = self.conn.lock().unwrap();
        let mut st = c.prepare(
            "SELECT kind, ref, score, passed, created FROM attempts WHERE learner = ?1 ORDER BY id DESC LIMIT 200",
        )?;
        let rows = st
            .query_map(params![learner], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get::<_, u32>(2)?, r.get::<_, i32>(3)? != 0, r.get(4)?))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn reset(&self, learner: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute("DELETE FROM progress WHERE learner = ?1", params![learner])?;
        c.execute("DELETE FROM attempts WHERE learner = ?1", params![learner])?;
        Ok(())
    }
}
