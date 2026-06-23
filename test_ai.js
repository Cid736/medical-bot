const ai = require('./ai');

function probar(phone, input) {
	const out = ai.getReplyWithPhone(phone, input);
	console.log(`INPUT: ${JSON.stringify(input)} =>`, JSON.stringify(out));
}

function seq(phone, inputs) {
	console.log(`\n--- SEQ ${phone} ---`);
	for (const input of inputs) {
		probar(phone, input);
	}
}

// Individual quick checks
probar('tg:test1', '1');
probar('tg:test2', '1️⃣');

// Back / volver tests
probar('tg:test3', '0');
probar('tg:test4', 'atrás');
probar('tg:test5', 'back');
probar('tg:test6', 'volver');

// Other services via keycap emojis and digits (single-message checks)
probar('tg:test7', '2');
probar('tg:test8', '2️⃣');
probar('tg:test9', '3');
probar('tg:test10', '3️⃣');

// Sequential conversation tests (flow behaviour)
seq('tg:flow1', ['hola', '1', '1']); // hola -> pedir cita -> seleccionar limpieza
seq('tg:flow2', ['hola', '1', '2']); // hola -> pedir cita -> seleccionar blanqueamiento
seq('tg:flow3', ['hola', '1', '1', '0', '0']); // navegar atrás: ask_name -> ask_service -> menu principal

// Validación de nombre y teléfono (v3)
seq('tg:name-valid-ok', ['hola', '1', '1', 'Ana García']);
seq('tg:name-invalid', ['hola', '1', '1', 'Pene']);

seq('tg:phone-invalid', ['hola', '1', '1', 'Ana García', 'abc']);
seq('tg:phone-valid-plain', ['hola', '1', '1', 'Ana García', '612345678']);
seq('tg:phone-valid-plus', ['hola', '1', '1', 'Ana García', '+34612345678']);
seq('tg:phone-valid-0034', ['hola', '1', '1', 'Ana García', '0034612345678']);
seq('tg:phone-valid-format', ['hola', '1', '1', 'Ana García', '612-345-678']);

// Validaciones adicionales (v4)
seq('tg:name-reject-semen', ['hola', '1', '1', 'semen']);
seq('tg:name-reject-pene', ['hola', '1', '1', 'Pene López']);
seq('tg:name-reject-zzzz', ['hola', '1', '1', 'zzzz']);
seq('tg:name-reject-ab', ['hola', '1', '1', 'ab']);
seq('tg:name-reject-test', ['hola', '1', '1', 'test']);

seq('tg:name-accept-carlos', ['hola', '1', '1', 'Carlos Ruiz']);
seq('tg:name-accept-maria', ['hola', '1', '1', 'María José']);
seq('tg:name-accept-oscar', ['hola', '1', '1', 'Óscar']);

// Flujo de consulta de cita
seq('tg:consult-prompt', ['hola', '4']);
seq('tg:consult-invalid-format', ['hola', '4', 'CITA-xxx']);
seq('tg:consult-notfound', ['hola', '4', 'CITA-A3F7']);
