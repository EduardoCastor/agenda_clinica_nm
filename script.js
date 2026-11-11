/* ═══════════════════════════════════════════════════════
   AGENDA + CANCELAMENTO — script.js
═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ════════════════════════════════════════════════════
    // ABAS — NAVEGAÇÃO
    // ════════════════════════════════════════════════════
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.view-panel');

    function switchTab(targetTab) {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });

        const activeTab = document.querySelector(`.tab[data-tab="${targetTab}"]`);
        const activePanel = document.getElementById(`panel${capitalize(targetTab)}`);

        activeTab.classList.add('active');
        activePanel.style.display = 'block';

        void activePanel.offsetWidth;
        activePanel.classList.add('active');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    panels.forEach(p => {
        if (!p.classList.contains('active')) {
            p.style.display = 'none';
        }
    });

    // ════════════════════════════════════════════════════
    // CONSTANTES COMPARTILHADAS
    // ════════════════════════════════════════════════════
    const BASE_URL = 'https://n8n.srv1352561.hstgr.cloud/webhook';

    const FERIADOS = [
        '2026-01-01', '2026-04-21', '2026-04-23', '2026-04-24',
        '2026-05-01', '2026-06-04', '2026-06-05', '2026-09-07',
        '2026-10-12', '2026-11-02', '2026-11-13', '2026-11-20', '2026-12-25'
    ];

    const DIAS_BLOQUEADOS = [0, 3, 6]; // Dom, Qua, Sáb

    function toISO(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function isDiaUtil(d) {
        return !DIAS_BLOQUEADOS.includes(d.getDay()) && !FERIADOS.includes(toISO(d));
    }

    function proximoDiaUtil(base = new Date()) {
        const d = new Date(base);
        do {
            d.setDate(d.getDate() + 1);
        } while (!isDiaUtil(d));
        return d;
    }

    function addDiasUteis(base, n) {
        const d = new Date(base);
        let c = 0;

        while (c < n) {
            d.setDate(d.getDate() + 1);
            if (isDiaUtil(d)) c++;
        }

        return d;
    }

    // ════════════════════════════════════════════════════
    // AGENDAMENTO
    // ════════════════════════════════════════════════════
    const formAgenda = document.getElementById('formAgenda');
    const successAgenda = document.getElementById('successAgenda');
    const selectHor = document.getElementById('horarios');
    const inputData = document.getElementById('data');
    const btnAgendar = document.getElementById('btnAgendar');

    // CAMPOS OBRIGATÓRIOS
    const camposObrigatoriosAgenda = formAgenda.querySelectorAll('[required]');

    // BOTÃO COMEÇA DESABILITADO
    btnAgendar.disabled = true;

    function validarFormularioAgenda() {

        const preenchidos = [...camposObrigatoriosAgenda].every(campo => {

            if (campo.type === 'checkbox' || campo.type === 'radio') {
                return campo.checked;
            }

            return campo.value.trim() !== '';
        });

        btnAgendar.disabled = !(preenchidos && selectHor.value);
    }

    camposObrigatoriosAgenda.forEach(campo => {
        campo.addEventListener('input', validarFormularioAgenda);
        campo.addEventListener('change', validarFormularioAgenda);
    });

    function configurarCalendario() {

        let hoje = new Date();

        if (hoje.getHours() >= 16) {
            hoje.setDate(hoje.getDate() + 1);
        }

        hoje.setHours(0, 0, 0, 0);

        const minDate = proximoDiaUtil(hoje);
        const maxDate = addDiasUteis(hoje, 5);

        inputData.min = toISO(minDate);
        inputData.max = toISO(maxDate);
        inputData.value = toISO(minDate);
    }

    async function carregarHorarios() {

        const dataSel = inputData.value;

        if (!dataSel) return;

        selectHor.innerHTML = '<option value="">Carregando...</option>';
        btnAgendar.disabled = true;

        try {

            const res = await fetch(`${BASE_URL}/disponibilidade?data=${dataSel}`);

            if (!res.ok) {
                throw new Error();
            }

            const data = await res.json();
            const slots = data.slots || data;

            if (!slots || slots.length === 0) {

                selectHor.innerHTML =
                    '<option value="">Sem horários disponíveis</option>';

                validarFormularioAgenda();
                return;
            }

            selectHor.innerHTML =
                '<option value="">Selecione o horário</option>';

            slots.forEach(slot => {

                const o = document.createElement('option');

                o.value = slot.inicio;
                o.textContent = slot.hora;

                selectHor.appendChild(o);
            });

            validarFormularioAgenda();

        } catch {

            selectHor.innerHTML =
                '<option value="">Erro ao carregar horários</option>';

            validarFormularioAgenda();
        }
    }

    selectHor.addEventListener('change', validarFormularioAgenda);

    inputData.addEventListener('change', () => {

        const d = new Date(inputData.value + 'T00:00:00');

        if (!isDiaUtil(d)) {

            alert('Não há atendimento nesse dia. Selecione um dia útil.');

            inputData.value = toISO(proximoDiaUtil(d));
        }

        carregarHorarios();
        validarFormularioAgenda();
    });

    formAgenda.addEventListener('submit', async (e) => {

        e.preventDefault();

        const dados = Object.fromEntries(new FormData(formAgenda));
        const inicio = selectHor.value;

        if (!inicio) {
            alert('Selecione um horário.');
            return;
        }

        btnAgendar.disabled = true;
        btnAgendar.innerHTML = 'Agendando...';

        try {

            const res = await fetch(`${BASE_URL}/agendar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...dados,
                    inicio
                })
            });

            if (!res.ok) {
                throw new Error();
            }

            formAgenda.style.display = 'none';
            successAgenda.classList.remove('hidden');

        } catch {

            alert('Erro ao agendar. Tente novamente.');

            btnAgendar.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Agendar Atendimento
            `;

            validarFormularioAgenda();
        }
    });

    // RESET PARA NOVO AGENDAMENTO
    window.resetAgenda = function () {

        formAgenda.reset();

        formAgenda.style.display = '';
        successAgenda.classList.add('hidden');

        btnAgendar.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Agendar Atendimento
        `;

        configurarCalendario();
        carregarHorarios();

        setTimeout(validarFormularioAgenda, 300);
    };

    // INICIALIZAÇÃO AGENDAMENTO
    configurarCalendario();
    carregarHorarios();
    validarFormularioAgenda();

    // ════════════════════════════════════════════════════
    // CANCELAMENTO
    // ════════════════════════════════════════════════════
    const formCancel = document.getElementById('formCancel');
    const protocoloEl = document.getElementById('protocolo');
    const feedbackEl = document.getElementById('feedbackCancel');
    const WEBHOOK_CANCEL = `${BASE_URL}/cancelar`;

    protocoloEl.addEventListener('input', () => {
        protocoloEl.value = protocoloEl.value.replace(/[^0-9]/g, '');
    });

    formCancel.addEventListener('submit', async (e) => {

        e.preventDefault();

        const protocolo = protocoloEl.value.trim();

        if (!protocolo) {
            alert('Informe o número do protocolo.');
            return;
        }

        const btnCancelar = document.getElementById('btnCancelar');

        btnCancelar.disabled = true;
        btnCancelar.innerHTML = 'Processando...';

        feedbackEl.classList.add('hidden');
        feedbackEl.className = 'feedback-cancel hidden';

        try {

            const res = await fetch(WEBHOOK_CANCEL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    protocolo
                })
            });

            if (!res.ok) {
                throw new Error();
            }

            feedbackEl.textContent =
                '✅ Cancelamento realizado com sucesso!';

            feedbackEl.className =
                'feedback-cancel success';

            feedbackEl.classList.remove('hidden');

            formCancel.reset();

        } catch {

            feedbackEl.textContent =
                '❌ Não foi possível cancelar. Verifique o protocolo ou tente novamente.';

            feedbackEl.className =
                'feedback-cancel error';

            feedbackEl.classList.remove('hidden');

        } finally {

            btnCancelar.disabled = false;

            btnCancelar.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Cancelar Agendamento
            `;
        }
    });

});
