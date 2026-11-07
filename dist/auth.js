/* Autenticação real: sessão e dados são validados pelo Supabase e pelas políticas RLS. */
(() => {
  const cfg = window.INVEST_AUTH_CONFIG;
  if (cfg?.mode === "demo") {
    window.startInvestDemo().catch((error) => {
      document.querySelector("#auth-status").textContent = error.message;
    });
    return;
  }
  const box = document.querySelector("#auth-form");
  const status = document.querySelector("#auth-status");
  let mode = "login";
  let client;
  let started = false;
  let entering = null;
  let authEpoch=0;
  const domainOk = (email) =>
    /^[^\s@]+@[^\s@]+$/.test(email) &&
    email.split("@")[1].toLowerCase() === cfg.allowedDomain.toLowerCase();
  const notify = (text) => {
    status.textContent = text;
  };
  const callbackUrl = new URL("./index.html", location.href).href;
  function screen(next) {
    mode = next;
    document
      .querySelectorAll("[data-auth-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.authMode === next),
      );
    document.querySelector("#auth-title").textContent = {
      login: "Acesse seu painel",
      signup: "Crie sua conta institucional",
      recover: "Recupere sua senha",
      reset: "Defina uma nova senha",
    }[next];
    document.querySelector("#name-field").hidden = next !== "signup";
    document.querySelector("#auth-name").required = next === "signup";
    document.querySelector("#email-field").hidden = next === "reset";
    document.querySelector("#auth-email").required = next !== "reset";
    document.querySelector("#password-field").hidden = next === "recover";
    document.querySelector("#auth-password").required = next !== "recover";
    document.querySelector("#auth-password").autocomplete =
      next === "login" ? "current-password" : "new-password";
    document.querySelector("#auth-password").minLength =
      next === "login" ? 1 : 8;
    document.querySelector("#auth-submit").textContent = {
      login: "Entrar",
      signup: "Cadastrar e confirmar e-mail",
      recover: "Enviar link de recuperação",
      reset: "Salvar nova senha",
    }[next];
    document.querySelector("#auth-password").value = "";
    notify(
      client
        ? ""
        : "Serviço institucional ainda não conectado. Cadastro e login aguardam configuração.",
    );
  }
  function clearPrivateCache() {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("asg-")) sessionStorage.removeItem(key);
  }
  function lock(message) {
    document.body.classList.remove("signed-in");
    document.querySelector("#auth-view").hidden = false;
    document.querySelector("#workspace").hidden = true;
    document.querySelector("#dialog").close();
    document.querySelector("#app").replaceChildren();
    window.clearInvestWorkspace?.();
    window.investAuth=null;
    if (message) notify(message);
  }
  async function enter(session) {
    if(entering)return entering;
    entering=loadSession(session).finally(()=>{entering=null;});
    return entering;
  }
  async function loadSession(session) {
    const epoch=authEpoch;
    if (mode === "reset" || !session) return;
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user || !user.email_confirmed_at || !domainOk(user.email))
      throw Error("Use uma conta institucional com e-mail confirmado.");
    const { data: profile, error: pe } = await client
      .from("staff_profiles")
      .select("role,active")
      .eq("id", user.id)
      .single();
    if (pe || !profile?.active)
      throw Error("Sua conta não está autorizada a acessar o painel.");
    const datasets=[];
    for(let offset=0;;offset+=100) {
      const {data:batch,error:de}=await client.from("asg_datasets")
        .select("id,source_name,reference_date,created_at,payload")
        .order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+99);
      if(de)throw Error("Não foi possível consultar a base protegida.");
      datasets.push(...batch);
      if(batch.length<100)break;
    }
    if (!datasets?.length)
      throw Error(
        "Acesso confirmado. A base ainda precisa ser carregada pelo administrador.",
      );
    if(epoch!==authEpoch)return;
    for(const dataset of datasets) ASG.validate(dataset.payload);
    clearPrivateCache();
    window.investAuth = {
      client,
      user,
      profile,
      datasets,
      async saveDataset(payload, sourceName) {
        if (profile.role !== "admin")
          throw Error("Somente administradores podem importar dados.");
        ASG.validate(payload);
        const referenceDate = payload["Parâmetros"]?.find(
          (r) => r[1] === "Data-base",
        )?.[2];
        const { data, error } = await client
          .from("asg_datasets")
          .insert({
            source_name: sourceName,
            reference_date: referenceDate,
            payload,
          })
          .select()
          .single();
        if (error) throw Error("A importação não foi salva no servidor.");
        datasets.unshift(data);
        return data;
      },
    };
    if(started){ location.reload();return; }
    document.querySelector("#user-email").textContent = user.email;
    document.querySelector("#workspace").hidden = false;
    document.querySelector("#auth-view").hidden = true;
    document.body.classList.add("signed-in");
    if (!started) {
      started = true;
      const script = document.createElement("script");
      script.src = "app.js?v=audit-20261107";
      script.onerror=()=>{started=false;lock("Não foi possível carregar o painel. Atualize a página.");};
      document.body.append(script);
    }
  }
  document
    .querySelectorAll("[data-auth-mode]")
    .forEach((b) => (b.onclick = () => screen(b.dataset.authMode)));
  box.onsubmit = async (e) => {
    e.preventDefault();
    if (!client)
      return notify("A conexão institucional ainda não foi configurada.");
    const submit = document.querySelector("#auth-submit");
    submit.disabled = true;
    notify("Aguarde…");
    try {
      const email = document
        .querySelector("#auth-email")
        .value.trim()
        .toLowerCase();
      const password = document.querySelector("#auth-password").value;
      if (mode !== "reset" && !domainOk(email))
        throw Error("Utilize um e-mail @" + cfg.allowedDomain + ".");
      if (mode === "signup") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl,
            data: {
              display_name: document.querySelector("#auth-name").value.trim(),
            },
          },
        });
        if (error)
          throw Error(
            "Não foi possível concluir o cadastro. Confira o domínio e a política de senha.",
          );
        notify(
          "Se o cadastro for permitido, você receberá um e-mail para confirmar o acesso. O endereço precisa existir.",
        );
      } else if (mode === "recover") {
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl,
        });
        notify(
          "Se houver uma conta apta a receber a mensagem, enviaremos um link de recuperação.",
        );
      } else if (mode === "reset") {
        const { error } = await client.auth.updateUser({ password });
        if (error)
          throw Error(
            "O link expirou ou a senha não atende aos requisitos. Solicite um novo link.",
          );
        await client.auth.signOut();
        screen("login");
        notify("Senha atualizada. Entre com sua nova senha.");
      } else {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          throw Error(
            "Não foi possível entrar. Confira suas credenciais e a confirmação do e-mail.",
          );
        await enter(data.session);
      }
    } catch (e) {
      notify(e.message);
    } finally {
      submit.disabled = false;
    }
  };
  document.querySelector("#logout").onclick = async () => {
    await client.auth.signOut();
    clearPrivateCache();
    location.reload();
  };
  screen("login");
  if (!cfg?.url || !cfg?.publishableKey) {
    document.querySelector("#auth-submit").disabled = true;
    return notify(
      "Versão em preparação. O serviço de autenticação institucional ainda não foi conectado. Nenhuma conta de exemplo foi criada.",
    );
  }
  client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      storage: sessionStorage,
      storageKey: "invest-internal-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  // O link de recuperação não libera o painel até finalizar a troca de senha.
  if (new URLSearchParams(location.hash.slice(1)).get("type") === "recovery")
    screen("reset");
  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      lock();
      screen("reset");
    } else if (event === "SIGNED_OUT") {
      authEpoch++;
      clearPrivateCache();
      lock("Sessão encerrada.");
    } else if (event === "TOKEN_REFRESHED" && session) {
      setTimeout(async()=>{
        try {
          const {data:{user},error}=await client.auth.getUser();
          if(error || !user?.email_confirmed_at || !domainOk(user.email))throw Error();
          const {data:profile,error:pe}=await client.from("staff_profiles").select("role,active").eq("id",user.id).single();
          if(pe || !profile?.active || profile.role!==window.investAuth?.profile?.role)throw Error();
        }catch {authEpoch++;lock("Acesso alterado ou expirado. Entre novamente.");}
      },0);
    } else if (event === "TOKEN_REFRESHED" && !session) {
      clearPrivateCache();
      lock("Sua sessão expirou.");
    }
  });
  client.auth
    .getSession()
    .then(({ data: { session } }) => session && enter(session))
    .catch((e) => lock(e.message));
})();
