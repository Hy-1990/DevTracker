use serde::{Deserialize, Deserializer, Serialize};

/// Deserialize a double-Option: absent → None, explicit null → Some(None), value → Some(Some(v))
fn deserialize_option_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Member {
    pub id: i64,
    pub name: String,
    pub role: String, // "dev" or "test"
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Board {
    pub id: i64,
    pub name: String,
    pub year_month: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub board_id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    #[serde(rename = "type")]
    pub task_type: String,
    pub project_id: Option<i64>,
    pub owner_id: Option<i64>,
    pub start_date: Option<String>,
    pub estimated_test_date: Option<String>,
    pub actual_test_date: Option<String>,
    pub estimated_release_date: Option<String>,
    pub completion_date: Option<String>,
    pub progress: i32,
    pub progress_auto: bool,
    pub story_points: f64,
    pub quality_rating: Option<i32>,
    pub latest_note: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskWithRelations {
    #[serde(flatten)]
    pub task: Task,
    pub project: Option<Project>,
    pub assignees: Vec<Member>,
    pub testers: Vec<Member>,
    pub owner: Option<Member>,
    pub children: Vec<TaskWithRelations>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub board_id: i64,
    pub parent_id: Option<i64>,
    pub name: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub task_type: Option<String>,
    pub project_id: Option<i64>,
    pub owner_id: Option<i64>,
    pub assignee_ids: Option<Vec<i64>>,
    pub tester_ids: Option<Vec<i64>>,
    pub start_date: Option<String>,
    pub estimated_test_date: Option<String>,
    pub actual_test_date: Option<String>,
    pub estimated_release_date: Option<String>,
    pub completion_date: Option<String>,
    pub progress: Option<i32>,
    pub progress_auto: Option<bool>,
    pub story_points: Option<f64>,
    #[serde(default, deserialize_with = "deserialize_option_option")]
    pub quality_rating: Option<Option<i32>>,
    pub latest_note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskFilters {
    pub status: Option<Vec<String>>,
    pub priority: Option<Vec<String>>,
    pub project_id: Option<i64>,
    pub assignee_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct BatchUpdateInput {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_ids: Option<Vec<i64>>,
}
