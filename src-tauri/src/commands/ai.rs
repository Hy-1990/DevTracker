use serde::Deserialize;

#[derive(Deserialize)]
struct DsResponse {
    choices: Vec<DsChoice>,
}

#[derive(Deserialize)]
struct DsChoice {
    message: DsMessage,
}

#[derive(Deserialize)]
struct DsMessage {
    content: String,
}

/// 代理 DeepSeek API（webview 直连会被 CORS 拦截）
#[tauri::command]
pub async fn ai_complete(api_key: String, prompt: String) -> Result<String, String> {
    let body = serde_json::json!({
        "model": "deepseek-chat",
        "messages": [{ "role": "user", "content": prompt }],
        "temperature": 0.6,
    });

    let result = tauri::async_runtime::spawn_blocking(move || {
        ureq::post("https://api.deepseek.com/chat/completions")
            .set("Authorization", &format!("Bearer {}", api_key))
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(120))
            .send_json(body)
    })
    .await
    .map_err(|e| e.to_string())?;

    match result {
        Ok(resp) => {
            let parsed: DsResponse = resp.into_json().map_err(|e| e.to_string())?;
            parsed
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .ok_or_else(|| "DeepSeek 返回为空".to_string())
        }
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            Err(format!("DeepSeek API 错误 {}: {}", code, text))
        }
        Err(e) => Err(format!("请求失败: {}", e)),
    }
}
