"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DRIVER"); // Default to driver
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // For Phase 1, we'll use mock authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock credentials for Phase 1
    const validCredentials = {
      admin: { username: "admin", password: "admin123", role: "ADMIN" },
      superadmin: {
        username: "superadmin",
        password: "superadmin123",
        role: "SUPER_ADMIN",
      },
      driver: { username: "driver", password: "driver123", role: "DRIVER" },
    };

    // Check if credentials match
    let isAuthenticated = false;
    let userRole = "";

    if (
      role === "ADMIN" &&
      username === validCredentials.admin.username &&
      password === validCredentials.admin.password
    ) {
      isAuthenticated = true;
      userRole = "ADMIN";
    } else if (
      role === "SUPER_ADMIN" &&
      username === validCredentials.superadmin.username &&
      password === validCredentials.superadmin.password
    ) {
      isAuthenticated = true;
      userRole = "SUPER_ADMIN";
    } else if (
      role === "DRIVER" &&
      username === validCredentials.driver.username &&
      password === validCredentials.driver.password
    ) {
      isAuthenticated = true;
      userRole = "DRIVER";
    }

    if (isAuthenticated) {
      // Create a mock token (in a real app, this would be a JWT)
      const mockToken = btoa(
        JSON.stringify({
          id: "123",
          username,
          role: userRole,
        })
      );

      // Store in localStorage
      localStorage.setItem("token", mockToken);
      localStorage.setItem("role", userRole);
      localStorage.setItem("userId", "123");

      // Redirect based on role
      if (userRole === "DRIVER") {
        router.push("/driver");
      } else {
        router.push("/admin");
      }
    } else {
      setError("Invalid username or password");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-black tracking-tight uppercase">
            B&R FOOD
            <br />
            SERVICES
          </h1>
          <h2 className="text-4xl font-medium mt-12 mb-10">Sign in</h2>
        </div>

        {error && <div className="text-red-600 text-center mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="hidden">
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded focus:outline-none"
            >
              <option value="DRIVER">Driver</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div>
            <input
              id="username"
              type="text"
              placeholder="Email address"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded focus:outline-none"
              required
            />
          </div>

          <div>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded focus:outline-none"
              required
            />
          </div>

          <div className="text-right">
            <a href="#" className="text-black hover:underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-4 px-4 rounded transition duration-200"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
