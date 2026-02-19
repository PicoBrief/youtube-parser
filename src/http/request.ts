import axios, { AxiosRequestConfig } from "axios";

export async function makeHttpRequest(params: {
    url: string;
    proxyUrl?: string | null;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE";
    requestData?: string;
    headers?: Record<string, string>;
    timeout?: number;
}): Promise<{ text: string; status: number; proxyUrl?: string | null }> {
    const { url, proxyUrl, method = "GET", requestData, headers = {}, timeout = 30000 } = params;

    try {
        const config: AxiosRequestConfig = {
            url,
            method,
            timeout,
            headers: {
                "Accept-Language": "en-US",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                ...headers,
            },
            validateStatus: () => true,
        };

        if (requestData) {
            config.data = requestData;
            config.headers!["Content-Type"] = config.headers!["Content-Type"] || "application/json";
        }

        if (proxyUrl) {
            const { HttpsProxyAgent } = await import("https-proxy-agent");
            config.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        const response = await axios(config);

        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: ${response.data}`);
        }

        return {
            text: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
            status: response.status,
            proxyUrl,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
                throw new Error("Request timeout");
            }
            if (error.response) {
                throw new Error(`HTTP ${error.response.status}`);
            }
            throw new Error(error.message);
        }
        throw error;
    }
}
