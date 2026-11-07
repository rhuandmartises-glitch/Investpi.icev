/* Demonstração pública: esta simulação não autentica no Supabase e não protege dados reais. */
window.startInvestDemo = async function startInvestDemo() {
  const $ = (selector) => document.querySelector(selector);
  const allowedDomain = window.INVEST_AUTH_CONFIG.allowedDomain;
  const defaultEmail = "rhuan.douglas@investepiaui.com";
  const stateKey = "invest-demo-accounts-v1";
  const datasetKey = "invest-demo-datasets-v1";
  let accounts = JSON.parse(sessionStorage.getItem(stateKey) || "{}");
  let mode = "login";
  let recoveryEmail = null;
  let loaded = false;
  const normalize = (value) => value.trim().toLowerCase().replace(/\.+@/, "@");
  const validEmail = (value) =>
    /^[^\s@]+@[^\s@]+$/.test(value) && value.split("@")[1] === allowedDomain;
  const digest = async (password, salt) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(salt + ":" + password),
        ),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  const storeAccounts = () =>
    sessionStorage.setItem(stateKey, JSON.stringify(accounts));
  const notify = (message) => {
    $("#auth-status").textContent = message;
  };
  const assertPassword = (password) => {
    if (password.length < 8)
      throw Error("A senha precisa ter no mínimo 8 caracteres.");
  };
  async function saveAccount(email, password, name) {
    assertPassword(password);
    const salt = crypto.randomUUID();
    accounts[email] = { name, salt, hash: await digest(password, salt) };
    storeAccounts();
  }
  if (!accounts[defaultEmail])
    await saveAccount(defaultEmail, "12345678", "Rhuan Douglas (exemplo)");
  const banner = document.createElement("div");
  banner.className = "demo-banner";
  banner.innerHTML =
    "<strong>MODO DEMONSTRAÇÃO</strong> · Login simulado e dados fictícios. Não use senhas ou informações reais.";
  document.body.prepend(banner);
  const credentials = document.createElement("p");
  credentials.className = "demo-credentials";
  credentials.textContent =
    "Conta de exemplo: " + defaultEmail + " · Senha: 12345678";
  $("#auth-form").before(credentials);
  const resetDemo = document.createElement("button");
  resetDemo.className = "auth-link";
  resetDemo.type = "button";
  resetDemo.textContent = "Restaurar demonstração";
  $("#auth-status").after(resetDemo);
  resetDemo.onclick = () => {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("invest-demo-") || key.startsWith("asg-"))
        sessionStorage.removeItem(key);
    location.reload();
  };
  $("#auth-view .auth-card > p").textContent =
    "Demonstração para apresentação. Cadastro e recuperação são simulados nesta sessão do navegador.";
  $("#auth-view .auth-card > small").textContent =
    "Nenhuma conta real é criada e nenhum e-mail é enviado. O banco institucional não é acessado. Senha mínima: 8 caracteres, sem exigência de composição.";
  function screen(next) {
    mode = next;
    document
      .querySelectorAll("[data-auth-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.authMode === next),
      );
    $("#auth-title").textContent = {
      login: "Entre na demonstração",
      signup: "Cadastro de demonstração",
      recover: "Recuperação simulada",
      reset: "Redefinir senha de demonstração",
    }[next];
    $("#name-field").hidden = next !== "signup";
    $("#auth-name").required = next === "signup";
    $("#email-field").hidden = next === "reset";
    $("#auth-email").required = next !== "reset";
    $("#password-field").hidden = next === "recover";
    $("#auth-password").required = next !== "recover";
    $("#auth-password").minLength = 8;
    $("#auth-password").value = "";
    $("#auth-password").autocomplete =
      next === "login" ? "current-password" : "new-password";
    $("#auth-submit").disabled = false;
    $("#auth-submit").textContent = {
      login: "Entrar na demonstração",
      signup: "Criar conta fictícia",
      recover: "Simular envio de recuperação",
      reset: "Salvar senha de exemplo",
    }[next];
    $("#demo-recovery-link")?.remove();
    notify("");
  }
  document
    .querySelectorAll("[data-auth-mode]")
    .forEach((b) => (b.onclick = () => screen(b.dataset.authMode)));
  async function enter(email) {
    const response = await fetch("demo-data.json", { cache: "no-cache" });
    if (!response.ok)
      throw Error("Não foi possível carregar a base de demonstração.");
    const fixture = await response.json();
    if (
      fixture.demo !== true ||
      !fixture.payload?.["Leia-me"]?.some((r) =>
        String(r[0]).includes("fictício"),
      )
    )
      throw Error("A base não está identificada como fictícia.");
    const initial = {
      id: "demo-initial",
      source_name: "Planilha fictícia de demonstração",
      reference_date: fixture.reference_date,
      created_at: fixture.snapshot_at,
      payload: fixture.payload,
    };
    const datasets = JSON.parse(
      sessionStorage.getItem(datasetKey) || "null",
    ) || [initial];
    window.investAuth = {
      demo: true,
      user: { email },
      profile: { role: "admin", active: true },
      datasets,
      async saveDataset(payload, sourceName) {
        if (
          !payload?.["Leia-me"]?.some((r) =>
            String(r[0]).toLowerCase().includes("fictíci"),
          )
        )
          throw Error(
            "A demonstração aceita somente bases identificadas como fictícias.",
          );
        const referenceDate = payload["Parâmetros"]?.find(
          (r) => r[1] === "Data-base",
        )?.[2];
        const next = {
          id: crypto.randomUUID(),
          source_name: sourceName,
          reference_date: referenceDate,
          created_at: new Date().toISOString(),
          payload,
        };
        const updated = [next, ...datasets];
        sessionStorage.setItem(datasetKey, JSON.stringify(updated));
        datasets.unshift(next);
        return next;
      },
    };
    $("#user-email").textContent = email + " · exemplo";
    $("#auth-view").hidden = true;
    $("#workspace").hidden = false;
    document.body.classList.add("signed-in");
    $("#logout").onclick = () => {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith("asg-")) sessionStorage.removeItem(key);
      location.reload();
    };
    if (!loaded) {
      loaded = true;
      const script = document.createElement("script");
      script.src = "app.js";
      script.onerror = () => {
        loaded = false;
        $("#workspace").hidden = true;
        $("#auth-view").hidden = false;
        notify("Não foi possível abrir o painel. Atualize a página.");
      };
      document.body.append(script);
    }
  }
  $("#auth-form").onsubmit = async (event) => {
    event.preventDefault();
    $("#auth-submit").disabled = true;
    try {
      const email = normalize($("#auth-email").value);
      const password = $("#auth-password").value;
      if (mode !== "reset" && !validEmail(email))
        throw Error("Use um e-mail de exemplo @" + allowedDomain + ".");
      if (mode === "login") {
        assertPassword(password);
        const account = accounts[email];
        if (!account || account.hash !== (await digest(password, account.salt)))
          throw Error("E-mail ou senha de demonstração incorretos.");
        await enter(email);
      } else if (mode === "signup") {
        if (accounts[email])
          throw Error(
            "Este e-mail de exemplo já está cadastrado nesta sessão.",
          );
        await saveAccount(email, password, $("#auth-name").value.trim());
        screen("login");
        $("#auth-email").value = email;
        notify(
          "Conta fictícia criada e confirmação simulada. Entre com a senha escolhida. Nenhum e-mail foi enviado.",
        );
      } else if (mode === "recover") {
        recoveryEmail = accounts[email] ? email : null;
        notify(
          "Simulação: nenhum e-mail foi enviado. Para experimentar a redefinição de uma conta fictícia existente, use o botão abaixo.",
        );
        if (recoveryEmail) {
          const link = document.createElement("button");
          link.type = "button";
          link.id = "demo-recovery-link";
          link.className = "btn";
          link.textContent = "Abrir redefinição simulada";
          link.onclick = () => screen("reset");
          $("#auth-status").after(link);
        }
      } else if (mode === "reset") {
        if (!recoveryEmail || !accounts[recoveryEmail])
          throw Error("Reinicie a recuperação simulada.");
        await saveAccount(
          recoveryEmail,
          password,
          accounts[recoveryEmail].name,
        );
        screen("login");
        $("#auth-email").value = recoveryEmail;
        recoveryEmail = null;
        notify(
          "Senha de demonstração alterada somente nesta sessão. Nenhuma conta institucional foi modificada.",
        );
      }
    } catch (error) {
      notify(error.message);
    } finally {
      $("#auth-submit").disabled = false;
      $("#auth-password").value = "";
    }
  };
  screen("login");
};
