import {
  authenticate,
  ensureArray,
  formatDate,
  formatTime,
  tomorrow,
} from './state.js';
import { fetchLoads, listContacts, saveLoads, upsertContact } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    loads: [],
    contacts: { transportistas: [], clientes: [] },
    activityLog: [],
  };
  let currentUser = null;

  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const userPill = document.getElementById('userPill');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');

  const refreshLoadsBtn = document.getElementById('refreshLoadsBtn');
  const saveHoursBtn = document.getElementById('saveHoursBtn');
  const sendEmailsBtn = document.getElementById('sendEmailsBtn');
  const loadsTable = document.getElementById('loadsTable');
  const activityLog = document.getElementById('activityLog');
  const agendaDate = document.getElementById('agendaDate');
  const agendaContainer = document.getElementById('agendaContainer');
  const transportForm = document.getElementById('transportForm');
  const clientForm = document.getElementById('clientForm');
  const transportList = document.getElementById('transportList');
  const clientList = document.getElementById('clientList');
  const responsesTable = document.getElementById('responsesTable');

  const panels = document.querySelectorAll('.panel');
  const navItems = document.querySelectorAll('.nav__item');

  agendaDate.value = tomorrow();

  const randomId = () =>
    (window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2));

  const addLogEntry = (message) => {
    const now = new Date();
    state.activityLog.unshift({
      id: randomId(),
      timestamp: now.toISOString(),
      message,
      user: currentUser?.username || 'sistema',
    });
    state.activityLog = state.activityLog.slice(0, 100);
    renderActivityLog();
  };

  const handleError = (error, context) => {
    console.error(context, error);
    addLogEntry(`${context}: ${error.message}`);
    alert(`${context}. Detalle: ${error.message}`);
  };

  const getTransportista = (codigo) =>
    state.contacts.transportistas.find(
      (item) => item.codigo.toLowerCase() === (codigo || '').toLowerCase(),
    );

  const getCliente = (codigo) =>
    state.contacts.clientes.find(
      (item) => item.codigo.toLowerCase() === (codigo || '').toLowerCase(),
    );

  const mapLoadFromApi = (item) => {
    const response = item.respuesta || {};
    const horas = ensureArray(response.horas || item.horasPropuestas);
    return {
      tipoPedido: item.tipoPedido || '',
      numEnvio: item.numEnvio,
      produccion: item.produccion || '',
      horaCarga: item.horaCarga || '',
      confirmado: item.confirmado || '',
      enviarCorreo: Boolean(item.enviarCorreo),
      horasPropuestas: horas,
      enviadoMail: item.enviadoMail || '',
      fechaCarga: item.fechaCarga || null,
      clienteId: item.clienteId || '',
      clienteNombre: item.clienteNombre || '',
      poblacion: item.poblacion || '',
      pedidoVenta: item.pedidoVenta || '',
      ordenFabricacion: item.ordenFabricacion || '',
      articuloId: item.articuloId || '',
      articuloNombre: item.articuloNombre || '',
      qty: item.qty || 0,
      transportista: item.transportista || response.transportista || '',
      susNuestros: item.susNuestros || '',
      observacionesEnvio: item.observacionesEnvio || '',
      horarioDescarga: item.horarioDescarga || null,
      fechaDescarga: item.fechaDescarga || null,
      fechaDiff: item.fechaDiff || null,
      documento: item.documento || '',
      taxGroup: item.taxGroup || '',
      almacen: item.almacen || '',
      comentarioTransportista: response.comentario || '',
      respuestaEstado: response.estado || '',
      ultimaActualizacion: response.fecha || null,
    };
  };

  const renderActivityLog = () => {
    activityLog.innerHTML = '';
    state.activityLog.forEach((entry) => {
      const item = document.createElement('li');
      item.innerHTML = `
        <span>${entry.message}</span>
        <time datetime="${entry.timestamp}">
          ${new Date(entry.timestamp).toLocaleString('es-ES')}
        </time>
      `;
      activityLog.appendChild(item);
    });
  };

  const renderEmailBadge = (status, enviarCorreo) => {
    const normalised = (status || '').toString().trim().toLowerCase();
    if (normalised === 'enviado cambio') {
      return '<span class="badge badge--danger">Cambio propuesto</span>';
    }
    if (normalised === 'enviado') {
      return '<span class="badge badge--success">Enviado</span>';
    }
    if (enviarCorreo) {
      return '<span class="badge badge--warning">Pendiente</span>';
    }
    return '<span class="badge">Sin enviar</span>';
  };

  const renderConfirmationBadge = (status) => {
    const normalised = (status || '').toString().trim().toLowerCase();
    if (['si', 'sí', 'confirmado'].includes(normalised)) {
      return '<span class="badge badge--success">Sí</span>';
    }
    if (['no', 'rechazado'].includes(normalised)) {
      return '<span class="badge badge--danger">No</span>';
    }
    return '<span class="badge badge--warning">Pendiente</span>';
  };

  const renderResponse = (load) => {
    const comments = [];
    if (load.comentarioTransportista) {
      comments.push(`<div>${load.comentarioTransportista}</div>`);
    }
    const horas = ensureArray(load.horasPropuestas);
    if (horas.length) {
      comments.push(
        `<div class="table-meta">Horas propuestas: ${horas
          .map((hour) => `<span class="badge">${hour}</span>`)
          .join(' ')}</div>`,
      );
    }
    return comments.length
      ? comments.join('')
      : '<span class="table-meta">Sin respuesta</span>';
  };

  const renderLoadsTable = () => {
    const tbody = loadsTable.querySelector('tbody');
    tbody.innerHTML = '';

    const filtered = state.loads.filter((load) => load.fechaCarga === tomorrow());

    if (filtered.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 12;
      cell.textContent = 'No hay cargas confirmadas para mañana.';
      cell.classList.add('data-table__empty');
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    filtered.forEach((load) => {
      const transportista = getTransportista(load.transportista);
      const cliente = getCliente(load.clienteId);
      const row = document.createElement('tr');
      row.dataset.envio = load.numEnvio;
      row.innerHTML = `
        <td>${load.numEnvio}</td>
        <td>${load.pedidoVenta || load.tipoPedido}</td>
        <td>
          ${transportista?.nombre || load.transportista || '—'}
          <div class="table-meta">${load.transportista || 'Sin código'}</div>
        </td>
        <td>
          ${cliente?.nombre || load.clienteNombre || '—'}
          <div class="table-meta">${load.clienteId || 'Sin código'}</div>
        </td>
        <td>${formatDate(load.fechaCarga)}</td>
        <td><input type="time" value="${formatTime(load.horaCarga)}" /></td>
        <td>${renderEmailBadge(load.enviadoMail, load.enviarCorreo)}</td>
        <td><input type="checkbox" ${load.enviarCorreo ? 'checked' : ''} /></td>
        <td>${renderConfirmationBadge(load.respuestaEstado || load.confirmado)}</td>
        <td>${renderResponse(load)}</td>
        <td>${ensureArray(load.horasPropuestas)
          .map((hour) => `<span class="badge">${hour}</span>`)
          .join(' ') || '<span class="table-meta">—</span>'}</td>
        <td>${renderResponseLink(load)}</td>
      `;
      tbody.appendChild(row);
    });
  };

  const renderResponseLink = (load) => {
    const url = new URL(window.location.href);
    url.pathname = 'response.html';
    url.searchParams.set('envio', load.numEnvio);
    if (load.transportista) {
      url.searchParams.set('transportista', load.transportista);
    }
    return `<a href="${url.toString()}" target="_blank" rel="noopener">Abrir formulario</a>`;
  };

  const renderAgenda = () => {
    const date = agendaDate.value;
    const filtered = state.loads.filter((load) => load.fechaCarga === date);
    const grouped = filtered.reduce((acc, load) => {
      const key = load.horaCarga ? formatTime(load.horaCarga) : 'Sin hora asignada';
      acc[key] = acc[key] || [];
      acc[key].push(load);
      return acc;
    }, {});

    agendaContainer.innerHTML = '';

    if (!filtered.length) {
      agendaContainer.innerHTML = `
        <div class="info-banner">
          <strong>No hay cargas registradas.</strong>
          Selecciona otro día o pulsa "Listar cargas" para actualizar los datos.
        </div>
      `;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.classList.add('agenda-day');

    Object.entries(grouped)
      .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
      .forEach(([time, loads]) => {
        const slot = document.createElement('article');
        slot.classList.add('agenda-slot');
        slot.innerHTML = `
          <span class="agenda-slot__time">${time}</span>
          <ul class="agenda-slot__list">
            ${loads
              .map((load) => {
                const transportista = getTransportista(load.transportista);
                return `
                  <li>
                    ${load.numEnvio} · ${transportista?.nombre || load.transportista || 'Transportista sin asignar'}
                    <div class="table-meta">${load.pedidoVenta || load.tipoPedido} — ${load.clienteNombre}</div>
                  </li>
                `;
              })
              .join('')}
          </ul>
        `;
        wrapper.appendChild(slot);
      });

    agendaContainer.appendChild(wrapper);
  };

  const renderContacts = () => {
    transportList.innerHTML = '';
    state.contacts.transportistas.forEach((item) => {
      const entry = document.createElement('li');
      entry.innerHTML = `
        <strong>${item.codigo}</strong> · ${item.nombre}
        <span>${item.email}</span>
        ${item.telefono ? `<span>${item.telefono}</span>` : ''}
      `;
      transportList.appendChild(entry);
    });

    clientList.innerHTML = '';
    state.contacts.clientes.forEach((item) => {
      const entry = document.createElement('li');
      entry.innerHTML = `
        <strong>${item.codigo}</strong> · ${item.nombre}
        <span>${item.email}</span>
        ${item.telefono ? `<span>${item.telefono}</span>` : ''}
      `;
      clientList.appendChild(entry);
    });
  };

  const renderResponsesTable = () => {
    const tbody = responsesTable.querySelector('tbody');
    tbody.innerHTML = '';

    const responses = state.loads
      .map((load) => ({
        numEnvio: load.numEnvio,
        transportista: getTransportista(load.transportista)?.nombre || load.transportista,
        estado: load.respuestaEstado || load.confirmado,
        comentario: load.comentarioTransportista,
        horas: ensureArray(load.horasPropuestas),
        updatedAt: load.ultimaActualizacion,
      }))
      .filter(
        (response) =>
          response.estado || response.comentario || (response.horas && response.horas.length > 0),
      );

    if (!responses.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No se han registrado respuestas todavía.';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    responses
      .sort((a, b) => {
        if (a.updatedAt && b.updatedAt) {
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        }
        if (a.updatedAt) return -1;
        if (b.updatedAt) return 1;
        return a.numEnvio.localeCompare(b.numEnvio);
      })
      .forEach((response) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${response.numEnvio}</td>
          <td>${response.transportista || '—'}</td>
          <td>${renderConfirmationBadge(response.estado)}</td>
          <td>${response.comentario || '—'}</td>
          <td>${response.horas.length
            ? response.horas.map((hour) => `<span class="badge">${hour}</span>`).join(' ')
            : '—'}</td>
          <td>${response.updatedAt ? new Date(response.updatedAt).toLocaleString('es-ES') : '—'}</td>
        `;
        tbody.appendChild(row);
      });
  };

  const refreshUI = () => {
    renderLoadsTable();
    renderActivityLog();
    renderAgenda();
    renderContacts();
    renderResponsesTable();
  };

  const showPanel = (id) => {
    panels.forEach((panel) => {
      panel.hidden = panel.id !== id;
    });
    navItems.forEach((item) => {
      item.classList.toggle('is-active', item.dataset.target === id);
    });
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      showPanel(item.dataset.target);
      if (item.dataset.target === 'panel-agenda') {
        renderAgenda();
      }
    });
  });

  const loadContactsFromApi = async (log = false) => {
    try {
      const { transportistas = [], clientes = [] } = await listContacts();
      state.contacts.transportistas = transportistas;
      state.contacts.clientes = clientes;
      if (log) {
        addLogEntry('Contactos sincronizados.');
      }
      renderContacts();
    } catch (error) {
      handleError(error, 'Error al cargar los contactos');
    }
  };

  const loadLoadsFromApi = async (log = false) => {
    try {
      const { data } = await fetchLoads();
      state.loads = data.map(mapLoadFromApi);
      state.loads.sort((a, b) => a.numEnvio.localeCompare(b.numEnvio));
      if (log) {
        addLogEntry('Cargas sincronizadas.');
      }
      refreshUI();
    } catch (error) {
      handleError(error, 'Error al cargar las cargas');
    }
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const username = data.get('username');
    const password = data.get('password');
    const user = authenticate(username, password);

    if (!user) {
      loginError.hidden = false;
      return;
    }

    loginError.hidden = true;
    currentUser = user;
    userPill.hidden = false;
    userName.textContent = user.displayName;
    userRole.textContent = user.role;
    loginModal.style.display = 'none';
    addLogEntry(`Inicio de sesión de ${user.username}`);

    await loadContactsFromApi(false);
    await loadLoadsFromApi(true);
  });

  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    loginModal.style.display = 'grid';
    addLogEntry('Sesión finalizada');
  });

  refreshLoadsBtn.addEventListener('click', async () => {
    refreshLoadsBtn.disabled = true;
    await loadLoadsFromApi(true);
    refreshLoadsBtn.disabled = false;
  });

  saveHoursBtn.addEventListener('click', async () => {
    const rows = loadsTable.querySelectorAll('tbody tr');
    const updates = [];

    rows.forEach((row) => {
      const numEnvio = row.dataset.envio;
      const load = state.loads.find((item) => item.numEnvio === numEnvio);
      if (!load) return;
      const timeInput = row.querySelector('input[type="time"]');
      const checkbox = row.querySelector('input[type="checkbox"]');

      const newTime = timeInput.value;
      const newSend = checkbox.checked;

      if (newTime !== load.horaCarga || newSend !== load.enviarCorreo) {
        updates.push({
          numEnvio: load.numEnvio,
          horaCarga: newTime,
          enviarCorreo: newSend,
          horasPropuestas: load.horasPropuestas,
          confirmado: load.respuestaEstado || load.confirmado,
          enviadoMail: load.enviadoMail,
          fechaCarga: load.fechaCarga,
          clienteId: load.clienteId,
          produccion: load.produccion,
          poblacion: load.poblacion,
          transportista: load.transportista,
          susNuestros: load.susNuestros,
        });

        load.horaCarga = newTime;
        load.enviarCorreo = newSend;
      }
    });

    if (!updates.length) {
      addLogEntry('No hay cambios que guardar.');
      return;
    }

    saveHoursBtn.disabled = true;
    try {
      await saveLoads(updates);
      addLogEntry(`Horas de carga actualizadas (${updates.length}).`);
      await loadLoadsFromApi(false);
    } catch (error) {
      handleError(error, 'Error al guardar las horas');
    } finally {
      saveHoursBtn.disabled = false;
    }
  });

  sendEmailsBtn.addEventListener('click', async () => {
    const loadsToSend = state.loads.filter(
      (load) => load.enviarCorreo && load.horaCarga && load.fechaCarga === tomorrow(),
    );

    if (!loadsToSend.length) {
      addLogEntry('No hay cargas listas para el envío de correos.');
      return;
    }

    sendEmailsBtn.disabled = true;
    try {
      await saveLoads(
        loadsToSend.map((load) => ({
          numEnvio: load.numEnvio,
          horaCarga: load.horaCarga,
          enviarCorreo: load.enviarCorreo,
          horasPropuestas: load.horasPropuestas,
          confirmado: load.respuestaEstado || load.confirmado,
          enviadoMail: 'enviado',
          fechaCarga: load.fechaCarga,
          clienteId: load.clienteId,
          produccion: load.produccion,
          poblacion: load.poblacion,
          transportista: load.transportista,
          susNuestros: load.susNuestros,
        })),
      );
      addLogEntry(`Se han enviado ${loadsToSend.length} correos.`);
      await loadLoadsFromApi(false);
    } catch (error) {
      handleError(error, 'Error al registrar el envío de correos');
    } finally {
      sendEmailsBtn.disabled = false;
    }
  });

  loadsTable.addEventListener('change', (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    const numEnvio = row.dataset.envio;
    const load = state.loads.find((item) => item.numEnvio === numEnvio);
    if (!load) return;

    if (event.target.type === 'time') {
      load.horaCarga = event.target.value;
    }

    if (event.target.type === 'checkbox') {
      load.enviarCorreo = event.target.checked;
    }
  });

  agendaDate.addEventListener('change', () => {
    renderAgenda();
  });

  transportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(transportForm));
    try {
      await upsertContact('transportista', data);
      addLogEntry(`Contacto de transportista ${data.codigo} guardado.`);
      transportForm.reset();
      await loadContactsFromApi(false);
    } catch (error) {
      handleError(error, 'Error al guardar el transportista');
    }
  });

  clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(clientForm));
    try {
      await upsertContact('cliente', data);
      addLogEntry(`Contacto de cliente ${data.codigo} guardado.`);
      clientForm.reset();
      await loadContactsFromApi(false);
    } catch (error) {
      handleError(error, 'Error al guardar el cliente');
    }
  });

  const init = () => {
    renderContacts();
    renderActivityLog();
    renderAgenda();
    renderResponsesTable();
  };

  init();
});
