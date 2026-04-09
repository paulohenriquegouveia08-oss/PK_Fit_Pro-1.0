package com.pkfit.agent;

import com.pkfit.agent.adapters.*;
import com.pkfit.agent.core.AccessController;
import com.pkfit.agent.core.AppLogger;
import com.pkfit.agent.core.ConfigParser;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.stage.Stage;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class PkFitAgentDesktop extends Application {

    private Label statusLabel;
    private VBox logContainer;
    private TurnstileAdapter currentAdapter;
    private ConfigParser currentConfig;

    // Componentes de setup (pareamento)
    private TextField pairingCodeField;

    // Painéis alternáveis
    private VBox setupPanel;
    private VBox pairedPanel;
    private VBox centerBox;
    private ScrollPane scrollLog;

    // Labels de info da config salva
    private Label pairedAcademyLabel;
    private Label pairedTurnstileLabel;
    private Label pairedIpLabel;

    // Botões que precisam de referência
    private Button connectButton;
    private Button reconfigButton;

    @Override
    public void start(Stage primaryStage) {
        primaryStage.setTitle("PK Fit Pro Agent");

        // Painel Principal
        BorderPane root = new BorderPane();
        root.setPadding(new Insets(20));
        root.setStyle("-fx-background-color: #1a1a1a;");

        // ─── Cabeçalho ───
        Label titleLabel = new Label("PK Fit Pro - Agent da Catraca");
        titleLabel.setFont(Font.font("Segoe UI", FontWeight.BOLD, 24));
        titleLabel.setTextFill(Color.WHITE);

        Label subTitle = new Label("Configure a conexão com sua catraca");
        subTitle.setFont(Font.font("Segoe UI", 14));
        subTitle.setTextFill(Color.LIGHTGRAY);

        VBox headerBox = new VBox(5, titleLabel, subTitle);
        headerBox.setAlignment(Pos.CENTER);
        headerBox.setPadding(new Insets(0, 0, 20, 0));
        root.setTop(headerBox);

        // ─── Painel de Setup (Pareamento) ───
        setupPanel = createSetupPanel();

        // ─── Painel "Já Pareado" ───
        pairedPanel = createPairedPanel();

        // ─── Painel de Logs ───
        logContainer = new VBox(5);
        logContainer.setPadding(new Insets(10));
        logContainer.setStyle("-fx-background-color: #111; -fx-border-color: #333; -fx-border-radius: 5;");
        scrollLog = new ScrollPane(logContainer);
        scrollLog.setFitToWidth(true);
        scrollLog.setStyle("-fx-background: #111; -fx-border-color: transparent;");
        scrollLog.setPrefHeight(200);

        Label logTitle = new Label("\uD83D\uDCDC Logs de Acesso em Tempo Real:");
        logTitle.setTextFill(Color.LIGHTGRAY);

        centerBox = new VBox(10);
        root.setCenter(centerBox);

        // ─── Rodapé (Ações e Status) ───
        HBox actionButtons = new HBox(10);
        actionButtons.setAlignment(Pos.CENTER);

        Button openBtn = new Button("Liberar (Manual)");
        openBtn.setStyle(
                "-fx-background-color: #4CAF50; -fx-text-fill: white; -fx-padding: 10 20; -fx-font-weight: bold;");
        openBtn.setOnAction(e -> {
            try {
                if (currentAdapter != null)
                    currentAdapter.grantAccess(TurnstileAdapter.Direction.IN);
            } catch (Exception ex) {
                AppLogger.error("Erro liberar", ex);
            }
        });

        Button closeBtn = new Button("Bloquear (Manual)");
        closeBtn.setStyle(
                "-fx-background-color: #f44336; -fx-text-fill: white; -fx-padding: 10 20; -fx-font-weight: bold;");
        closeBtn.setOnAction(e -> {
            try {
                if (currentAdapter != null)
                    currentAdapter.denyAccess();
            } catch (Exception ex) {
                AppLogger.error("Erro bloquear", ex);
            }
        });

        actionButtons.getChildren().addAll(openBtn, closeBtn);

        statusLabel = new Label("Status: Aguardando Configuração...");
        statusLabel.setTextFill(Color.GRAY);
        statusLabel.setFont(Font.font("Segoe UI", 12));

        VBox footerBox = new VBox(15, actionButtons, statusLabel);
        footerBox.setAlignment(Pos.CENTER);
        footerBox.setPadding(new Insets(20, 0, 0, 0));
        root.setBottom(footerBox);

        // ─── Decidir qual tela mostrar ───
        if (ConfigParser.hasLocalConfig()) {
            showPairedView();
        } else {
            showSetupView();
        }

        // Configuração da Cena
        Scene scene = new Scene(root, 720, 680);
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    // ═══════════════════════════════════════════
    // CRIAÇÃO DOS PAINÉIS
    // ═══════════════════════════════════════════

    private VBox createSetupPanel() {
        VBox panel = new VBox(12);
        panel.setPadding(new Insets(15));
        panel.setStyle(
                "-fx-background-color: #222; -fx-border-color: #444; -fx-border-radius: 8; -fx-background-radius: 8;");

        Label setupTitle = new Label("🔗 Primeiro Uso — Pareamento");
        setupTitle.setFont(Font.font("Segoe UI", FontWeight.BOLD, 16));
        setupTitle.setTextFill(Color.web("#00d2ff"));

        Label setupDesc = new Label(
                "Informe o código de 6 dígitos gerado no painel web\n(Controle de Acesso → Catracas → Parear Agent).");
        setupDesc.setFont(Font.font("Segoe UI", 12));
        setupDesc.setTextFill(Color.LIGHTGRAY);
        setupDesc.setWrapText(true);

        pairingCodeField = createStyledField("Código de 6 dígitos (ex: AB1234)");

        connectButton = new Button("🔗 Parear e Conectar");
        connectButton.setStyle(
                "-fx-background-color: #00d2ff; -fx-text-fill: black; -fx-font-weight: bold; -fx-padding: 12 30; -fx-font-size: 14px; -fx-background-radius: 5; -fx-cursor: hand;");
        connectButton.setMaxWidth(Double.MAX_VALUE);
        connectButton.setOnAction(e -> handlePairing());

        panel.getChildren().addAll(setupTitle, setupDesc,
                createFieldLabel("🔗 Código de Pareamento"), pairingCodeField,
                connectButton);

        return panel;
    }

    private VBox createPairedPanel() {
        VBox panel = new VBox(10);
        panel.setPadding(new Insets(15));
        panel.setStyle(
                "-fx-background-color: #1a2e1a; -fx-border-color: #4CAF50; -fx-border-radius: 8; -fx-background-radius: 8;");

        Label pairedTitle = new Label("✅ Catraca Pareada");
        pairedTitle.setFont(Font.font("Segoe UI", FontWeight.BOLD, 16));
        pairedTitle.setTextFill(Color.LIGHTGREEN);

        pairedAcademyLabel = new Label("Academia: —");
        pairedAcademyLabel.setTextFill(Color.WHITE);
        pairedAcademyLabel.setFont(Font.font("Segoe UI", 13));

        pairedTurnstileLabel = new Label("Catraca: —");
        pairedTurnstileLabel.setTextFill(Color.WHITE);
        pairedTurnstileLabel.setFont(Font.font("Segoe UI", 13));

        pairedIpLabel = new Label("IP: —");
        pairedIpLabel.setTextFill(Color.LIGHTGRAY);
        pairedIpLabel.setFont(Font.font("Segoe UI", 12));

        HBox btnRow = new HBox(10);
        btnRow.setAlignment(Pos.CENTER);

        Button autoConnectBtn = new Button("⚡ Conectar Catraca");
        autoConnectBtn.setStyle(
                "-fx-background-color: #4CAF50; -fx-text-fill: white; -fx-font-weight: bold; -fx-padding: 10 25; -fx-font-size: 13px; -fx-background-radius: 5; -fx-cursor: hand;");
        autoConnectBtn.setOnAction(e -> handleAutoConnect(autoConnectBtn));

        reconfigButton = new Button("🔄 Reconfigurar");
        reconfigButton.setStyle(
                "-fx-background-color: #555; -fx-text-fill: white; -fx-padding: 10 20; -fx-font-size: 12px; -fx-background-radius: 5; -fx-cursor: hand;");
        reconfigButton.setOnAction(e -> handleReconfig());

        btnRow.getChildren().addAll(autoConnectBtn, reconfigButton);

        panel.getChildren().addAll(pairedTitle, pairedAcademyLabel, pairedTurnstileLabel, pairedIpLabel, btnRow);

        return panel;
    }

    // ═══════════════════════════════════════════
    // ALTERNÂNCIA DE TELAS
    // ═══════════════════════════════════════════

    private void showSetupView() {
        centerBox.getChildren().clear();

        Label logTitle = new Label("\uD83D\uDCDC Logs de Acesso em Tempo Real:");
        logTitle.setTextFill(Color.LIGHTGRAY);

        centerBox.getChildren().addAll(setupPanel, logTitle, scrollLog);
        updateStatus("Aguardando Pareamento...", Color.GRAY);
    }

    private void showPairedView() {
        centerBox.getChildren().clear();

        // Tentar carregar a config salva
        try {
            currentConfig = ConfigParser.loadFromFile();
            if (currentConfig != null) {
                pairedAcademyLabel.setText("🏢 Academia: " + currentConfig.getAcademyName());
                pairedTurnstileLabel.setText(
                        "🚪 Catraca: " + currentConfig.getTurnstileName() + " (" + currentConfig.getBrand() + ")");
                pairedIpLabel.setText("🌐 IP: " + currentConfig.getIpAddress() + ":" + currentConfig.getPort());
            }
        } catch (Exception e) {
            AppLogger.error("Erro ao carregar config", e);
            showSetupView();
            return;
        }

        Label logTitle = new Label("\uD83D\uDCDC Logs de Acesso em Tempo Real:");
        logTitle.setTextFill(Color.LIGHTGRAY);

        centerBox.getChildren().addAll(pairedPanel, logTitle, scrollLog);
        updateStatus("Pareado! Clique em 'Conectar Catraca' para iniciar.", Color.YELLOW);
    }

    // ═══════════════════════════════════════════
    // HANDLERS
    // ═══════════════════════════════════════════

    /**
     * Pareamento via código: valida credenciais e código, chama RPC, salva config
     */
    private void handlePairing() {
        String url = "https://fuovtooenanzcrsgpsxq.supabase.co";
        String key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1b3Z0b29lbmFuemNyc2dwc3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDE4NzMsImV4cCI6MjA4MTMxNzg3M30._rf15v-_Qw__kmX2bqV_JC2xQPVrFYOfdfisYmyAses";
        String code = pairingCodeField.getText().trim();

        if (code.isEmpty()) {
            updateStatus("Erro: Preencha o código de pareamento.", Color.RED);
            return;
        }

        updateStatus("Validando código de pareamento...", Color.YELLOW);
        connectButton.setDisable(true);

        new Thread(() -> {
            try {
                ConfigParser config = ConfigParser.redeemPairingCode(url, key, code);
                currentConfig = config;

                Platform.runLater(() -> {
                    updateStatus(
                            "✅ Pareamento concluído! " + config.getAcademyName() + " / " + config.getTurnstileName(),
                            Color.LIGHTGREEN);
                    appendLog(true, "Pareado com sucesso! Academia: " + config.getAcademyName());
                    showPairedView();
                    connectButton.setDisable(false);
                });

            } catch (Exception e) {
                AppLogger.error("Erro no pareamento", e);
                Platform.runLater(() -> {
                    updateStatus("Erro: " + e.getMessage(), Color.RED);
                    connectButton.setDisable(false);
                });
            }
        }).start();
    }

    /**
     * Conecta à catraca usando a config já salva localmente
     */
    private void handleAutoConnect(Button autoConnectBtn) {
        if (currentConfig == null) {
            updateStatus("Erro: Nenhuma configuração carregada.", Color.RED);
            return;
        }

        updateStatus("Conectando à catraca " + currentConfig.getBrand() + "...", Color.YELLOW);
        autoConnectBtn.setDisable(true);
        reconfigButton.setDisable(true);

        new Thread(() -> {
            try {
                // Validar credenciais do Supabase
                if (!currentConfig.validateConnection()) {
                    Platform.runLater(() -> {
                        updateStatus("Erro: Credenciais do Supabase inválidas.", Color.RED);
                        autoConnectBtn.setDisable(false);
                        reconfigButton.setDisable(false);
                    });
                    return;
                }

                // Criar adapter da catraca
                TurnstileAdapter adapter = createAdapter(currentConfig);
                adapter.connect();
                currentAdapter = adapter;

                // Iniciar AccessController
                AccessController controller = new AccessController(adapter, currentConfig);
                controller.setUiLogCallback((granted, msg) -> Platform.runLater(() -> appendLog(granted, msg)));
                controller.start();

                Platform.runLater(() -> {
                    updateStatus("Conectado! Catraca Operante 🟢", Color.LIGHTGREEN);
                    autoConnectBtn.setText("✅ Conectado");
                    appendLog(true, "Conectado à catraca " + adapter.getBrandName() + " em "
                            + currentConfig.getIpAddress() + ":" + currentConfig.getPort());
                });

            } catch (Exception e) {
                AppLogger.error("Falha na conexão", e);
                Platform.runLater(() -> {
                    updateStatus("Falha: " + e.getMessage(), Color.RED);
                    autoConnectBtn.setDisable(false);
                    reconfigButton.setDisable(false);
                });
            }
        }).start();
    }

    /**
     * Cria o adapter de hardware baseado na marca configurada
     */
    private TurnstileAdapter createAdapter(ConfigParser config) {
        String brand = config.getBrand().toUpperCase();
        switch (brand) {
            case "TOP_DATA":
                return new TopDataAdapter(config.getIpAddress(), config.getPort());
            case "HENRY":
                return new HenryAdapter(config.getIpAddress(), config.getPort(), config.getAuthUser(),
                        config.getAuthPassword());
            case "CONTROL_ID":
            default:
                return new ControlIdAdapter(config.getIpAddress(), config.getPort(), config.getAuthUser(),
                        config.getAuthPassword());
        }
    }

    /**
     * Reseta o pareamento e mostra tela de setup
     */
    private void handleReconfig() {
        // Desconectar adapter se estiver ativo
        if (currentAdapter != null) {
            try {
                currentAdapter.disconnect();
            } catch (Exception ignored) {
            }
            currentAdapter = null;
        }

        ConfigParser.deleteLocalConfig();
        currentConfig = null;

        // Limpar campos
        pairingCodeField.clear();
        logContainer.getChildren().clear();

        showSetupView();
        appendLog(false, "Configuração removida. Insira novo código de pareamento.");
    }

    // ═══════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════

    private TextField createStyledField(String prompt) {
        TextField field = new TextField();
        field.setPromptText(prompt);
        field.setStyle(
                "-fx-background-color: #2b2b2b; -fx-text-fill: white; -fx-font-family: 'Consolas'; -fx-font-size: 13px; -fx-border-color: #555; -fx-border-radius: 4; -fx-background-radius: 4; -fx-padding: 8;");
        field.setMaxWidth(Double.MAX_VALUE);
        return field;
    }

    private Label createFieldLabel(String text) {
        Label label = new Label(text);
        label.setTextFill(Color.LIGHTGRAY);
        label.setFont(Font.font("Segoe UI", FontWeight.SEMI_BOLD, 12));
        return label;
    }

    private void updateStatus(String message, Color color) {
        Platform.runLater(() -> {
            statusLabel.setText("Status: " + message);
            statusLabel.setTextFill(color);
        });
    }

    private void appendLog(boolean granted, String message) {
        String time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
        String color = granted ? "#4CAF50" : "#f44336";
        String icon = granted ? "✅" : "❌";

        Label logEntry = new Label(time + " " + icon + " " + message);
        logEntry.setStyle("-fx-text-fill: " + color + "; -fx-font-family: 'Consolas'; -fx-font-size: 13px;");
        logContainer.getChildren().add(0, logEntry);

        // Limita a 50 logs na tela
        if (logContainer.getChildren().size() > 50) {
            logContainer.getChildren().remove(50);
        }
    }

    public static void main(String[] args) {
        launch(args);
    }
}
