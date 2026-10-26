
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';


const API_URL = import.meta.env.VITE_LOCAL_API_URL;

function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();


  // login form
  async function handleSubmit(event) {
    event.preventDefault();

    if (login === "" || password === "") {
      setError("Заполните логин и пароль");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(API_URL + "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: login,
          password: password,
        }),
      });


      const data = await response.json();

      if (response.ok) {
        // saving user token
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", JSON.stringify(data.role));
        localStorage.setItem("userName", data.user_info?.name || data.username || "");

        // if a bank employee tries to open "/" -> redirecting them to "/bank"
        // if a user tries to open "/bank"      -> redirecting them to "/"
        //console.log(JSON.stringify(data.username));
        if (data.role === "EMPLOYEE") {
          navigate("/bank");
        } else {
          navigate("/");
        }
      } else {
        console.log("ЛОГИН 401, тело ответа:", data);
        setError(data.message || data.error || "Неверный логин или пароль");
      }
    } catch (e) {
      setError("Не удалось связаться с сервером. Попробуйте еще раз");
    }

    setLoading(false);
  }

  return (
    <div className="login-page">
      <img src="../../public/assets/alfa-logo-full.svg" className="login-logo" />

      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">
          Привет! Войдите
          <br />
          в мобильный банк
        </h1>

        <input
          className="login-input"
          type="text"
          placeholder="Логин"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />

        <div className="login-password-wrap">
          <input
            className="login-input"
            type={showPassword ? "text" : "password"}
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            className="login-eye"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
                <line x1="3" y1="3" x2="21" y2="21" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error !== "" && <p className="login-error">{error}</p>}

        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? "Вход..." : "Вперед"}
        </button>
      </form>
    </div>
  );
}

export default Login;