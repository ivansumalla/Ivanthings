import { ensureArray, formatDate, formatTime } from './state.js';
import { fetchLoads, listContacts, registerResponse } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const numEnvio = params.get('envio');
  const transportistaParam = params.get('transportista');

  const summaryEnvio = document.getElementById('summaryEnvio');
  const summaryTransportista = document.getElementById('summaryTransportista');
  const summaryCliente = document.getElementById('summaryCliente');
  const summaryFecha = document.getElementById('summaryFecha');
  const summaryHora = document.getElementById('summaryHora');
  const responseForm = document.getElementById('responseForm');
  const responseError = document.getElementById('responseError');
  const proposalFields = document.getElementById('proposalFields');
  const feedback = document.getElementById('responseFeedback');

  if (!numEnvio) {
    responseForm.hidden = true;
    feedback.hidden = false;
    feedback.classList.add('response-feedback--error');
    feedback.textContent = 'Falta el identificador de envío. Consulta con LIPSA.';
    return;
  }

  let load;
  let transportistas = [];

  try {
    const [{ data }, contacts] = await Promise.all([
      fetchLoads({ numEnvio }),
      listContacts(),
    ]);
    load = data.find((item) => item.numEnvio === numEnvio);
    transportistas = contacts.transportistas || [];
  } catch (error) {
    console.error('No se pudo cargar el envío', error);
    responseForm.hidden = true;
    feedback.hidden = false;
    feedback.classList.add('response-feedback--error');
    feedback.textContent = 'No ha sido posible recuperar la información del envío. Inténtalo más tarde.';
    return;
  }

  if (!load) {
    responseForm.hidden = true;
    feedback.hidden = false;
    feedback.classList.add('response-feedback--error');
    feedback.textContent = 'No hemos encontrado este envío. Contacta con el planificador.';
    return;
  }

  const horasPropuestas = ensureArray(load.respuesta?.horas || load.horasPropuestas);
  const transportistaCodigo = load.transportista || transportistaParam || '';
  const transportistaInfo = transportistas.find(
    (item) => item.codigo.toLowerCase() === transportistaCodigo.toLowerCase(),
  );

  summaryEnvio.textContent = load.numEnvio;
  summaryTransportista.textContent = transportistaInfo
    ? `${transportistaInfo.nombre} (${transportistaInfo.codigo})`
    : transportistaCodigo || 'Sin asignar';
  summaryCliente.textContent = `${load.clienteNombre || 'Cliente no disponible'} (${load.clienteId || '—'})`;
  summaryFecha.textContent = formatDate(load.fechaCarga);
  summaryHora.textContent = formatTime(load.horaCarga) || '—';

  const toggleProposalFields = (estado) => {
    const shouldShow = estado === 'Rechazado';
    proposalFields.hidden = !shouldShow;
  };

  responseForm.addEventListener('change', (event) => {
    if (event.target.name === 'estado') {
      toggleProposalFields(event.target.value);
      responseError.hidden = true;
    }
  });

  responseForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(responseForm);
    const estado = formData.get('estado');
    const comentario = (formData.get('comentario') || '').toString().trim();
    const horasRaw = (formData.get('horas') || '').toString();
    const horas = horasRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (estado === 'Rechazado' && horas.length === 0) {
      responseError.hidden = false;
      return;
    }

    try {
      await registerResponse({
        numEnvio,
        estado,
        comentario,
        horasPropuestas: horas,
        transportista: transportistaCodigo,
      });
    } catch (error) {
      console.error('No se pudo registrar la respuesta', error);
      responseError.hidden = false;
      responseError.textContent = error.message;
      return;
    }

    feedback.hidden = false;
    feedback.classList.remove('response-feedback--error');
    feedback.classList.add('response-feedback--success');
    feedback.innerHTML = `
      <h2>¡Gracias!</h2>
      <p>Hemos registrado tu ${estado === 'Confirmado' ? 'confirmación' : 'propuesta de cambio'}.</p>
      <p>El equipo de LIPSA recibirá un aviso inmediato.</p>
    `;
    responseForm.reset();
    responseForm.hidden = true;
  });

  if (horasPropuestas.length) {
    const horasField = responseForm.querySelector('textarea[name="horas"]');
    horasField.value = horasPropuestas.join(', ');
  }
});
