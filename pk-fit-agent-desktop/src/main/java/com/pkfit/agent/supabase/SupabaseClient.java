package com.pkfit.agent.supabase;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class SupabaseClient {

    private final String url;
    private final String serviceKey;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public SupabaseClient(String url, String serviceKey) {
        this.url = url;
        this.serviceKey = serviceKey;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.mapper = new ObjectMapper();
    }

    public JsonNode rpc(String functionName, ObjectNode bodyParams) throws Exception {
        String fullUrl = url + "/rest/v1/rpc/" + functionName;

        String jsonBody = (bodyParams != null) ? bodyParams.toString() : "{}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl))
                .header("apikey", serviceKey)
                .header("Authorization", "Bearer " + serviceKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new Exception("Supabase RPC Error HTTP " + response.statusCode() + ": " + response.body());
        }

        if (response.body() == null || response.body().isBlank()) {
            return mapper.createObjectNode();
        }
        
        return mapper.readTree(response.body());
    }

    public void insert(String table, ObjectNode row) throws Exception {
        String fullUrl = url + "/rest/v1/" + table;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl))
                .header("apikey", serviceKey)
                .header("Authorization", "Bearer " + serviceKey)
                .header("Content-Type", "application/json")
                .header("Prefer", "return=minimal")
                .POST(HttpRequest.BodyPublishers.ofString(row.toString()))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new Exception("Supabase Insert Error HTTP " + response.statusCode() + ": " + response.body());
        }
    }
}
