---
publishDate: 2026-04-29T10:00:00Z
title: "Por qué la retirada de OpenEvidence de la UE/Reino Unido empuja a la sanidad hacia soluciones on-premise o nube EU soberana"
excerpt: "La retirada de OpenEvidence de la UE y Reino Unido muestra por qué la IA clínica necesita soberanía, auditabilidad, control de subencargados y arquitectura on-premise o nube soberana."
image: ~/assets/images/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana.png
category: Cumplimiento IA Sanitaria
tags:
  - sanidad
  - ia
  - ia-clinica
  - rgpd
  - soberanía-datos
  - on-premise
  - nube-soberana
  - subencargados
lang: es
translationOf: openevidence-eu-uk-withdrawal-private-on-prem-sovereign-cloud
metadata:
  title: "Por qué la retirada de OpenEvidence de la UE/Reino Unido empuja a la sanidad hacia soluciones on-premise o nube EU soberana | Futurion Solutions"
  description: "Por qué la retirada de OpenEvidence de la UE/Reino Unido apunta a arquitecturas privadas on-premise y nube soberana para IA sanitaria, con RGPD, Reglamento de IA, subencargados e infraestructura clínica."
  robots:
    index: true
    follow: true
  openGraph:
    type: article
    images:
      - url: ~/assets/images/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana.png
        width: 1200
        height: 630
  twitter:
    cardType: summary_large_image
---

Cuando OpenEvidence dejó de estar disponible en la Unión Europea y el Reino Unido, mi primera reacción fue: esto no es solo un problema de disponibilidad de producto. Os dije que pasaría.

OpenEvidence se ha posicionado como un sistema de IA médica que responde a preguntas clínicas utilizando evidencia médica revisada por pares, citada y con fuentes. Las descripciones públicas y la investigación independiente sobre IA médica lo caracterizan no como un chatbot generalista independiente, sino como un sistema de generación aumentada por recuperación: una capa de LLM conectada a literatura médica curada, citas y fuentes de evidencia clínica, incluido contenido licenciado o de socios como NEJM, JAMA, NCCN y Cochrane.

Esa distinción importa. En sanidad, la diferencia entre "un modelo respondió desde la memoria" y "un sistema fundamentado en fuentes médicas controladas" no es cosmética. Es el producto.

**Así que quise entender qué había pasado realmente.**

OpenEvidence parece haberse retirado de la UE y del Reino Unido citando: "OpenEvidence is not available in the European Union or the U.K."

![Vista de cumplimiento del Trust Center de OpenEvidence](~/assets/images/openevidence-site.png)

<p class="text-center text-sm font-medium">En abril de 2026, en la UE:</p>

Link 1: https://news.bloomberglaw.com/us-law-week/eu-ai-acts-burdensome-regulations-could-impair-ai-innovation

Link 2: https://drive.google.com/file/d/1wrtxfvcD9FwfNfWGDL37Q6Nd8wBKXCkn/view?pli=1

A primera vista, esa explicación suena sencilla: Europa tiene una regulación de IA más estricta, así que OpenEvidence pausó la región.

## Entonces, ¿por qué abandonar la UE y el Reino Unido?

> No estamos generando una imagen graciosa. Estamos hablando de privacidad del paciente.

Empecé a revisar el rastro de confianza y cumplimiento normativo, y la historia se volvió más interesante.

El Trust Center público de OpenEvidence, "[https://trust.openevidence.com/](https://trust.openevidence.com/)", parece el de un proveedor serio, con controles como SOC 2, HIPAA, GDPR y otros compromisos de seguridad y privacidad. No es el perfil de un *wrapper* casual de IA intentando evitar por completo el cumplimiento normativo.

También comprobé la lista del Data Privacy Framework: "[https://www.dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list)".

En abril de 2026, OpenEvidence parece figurar en esa lista, lo que significa que puede apoyarse en el Marco de Privacidad de Datos UE-EE. UU. para transferencias cualificadas desde la UE a Estados Unidos, siempre que la transferencia y la cadena de tratamiento posterior estén correctamente documentadas.

La pregunta más importante no es solo si OpenEvidence tiene un marco de cumplimiento sólido. La verdadera pregunta es:

¿Quién más toca los datos, los *prompts*, los *embeddings*, las llamadas de inferencia, los registros, la infraestructura de entrenamiento y la capa de servicio del modelo?

**En sanidad, la cadena de subencargados del tratamiento suele ser donde vive el verdadero riesgo regulatorio.**

Eso me llevó a Baseten Labs, cuyo Trust Center público, https://trust.baseten.co, enumera áreas de cumplimiento como GDPR, HIPAA, SOC 2 Type 2 y SOC 3.

También lista públicamente a OpenEvidence entre las empresas que revisan o confían en Baseten.

OpenEvidence utiliza Baseten para infraestructura de IA, y parece ser algo más que un proveedor menor dentro de la pila tecnológica. Parece formar parte de la infraestructura central de entrega de IA, en la misma línea que OpenAI y Anthropic, cuyos modelos utiliza OpenEvidence según https://www.deploygraph.com/company/openevidence

## Aquí es donde la situación se vuelve delicada

Aunque Baseten Labs tiene una insignia de elegibilidad GDPR en abril de 2026, no pude encontrarla en https://www.dataprivacyframework.gov/list

Eso significa algo muy concreto:

> "Baseten no está certificada bajo el Marco de Privacidad de Datos UE-EE. UU."

Las partes necesitarían otro mecanismo legal de transferencia, normalmente cláusulas contractuales tipo y una cadena de subencargados del tratamiento claramente documentada.

> Para datos SaaS ordinarios, eso ya es serio. Para IA sanitaria, es mucho más serio.

## Los datos sanitarios de la UE no son datos SaaS normales

Los datos de salud en la UE son datos personales de categoría especial según el artículo 9 del RGPD, por lo que requieren una base jurídica clara y garantías más sólidas.

Si un proveedor sanitario utiliza un proveedor externo de IA, el artículo 28 del RGPD también exige que ese proveedor —y sus subencargados— ofrezcan garantías suficientes para un tratamiento conforme.

Y si los datos se transfieren fuera de la UE, el capítulo V del RGPD exige un mecanismo de transferencia válido, como el DPF para empresas estadounidenses certificadas o cláusulas contractuales tipo con garantías adecuadas.

Ahora añadamos el Reglamento de IA.

Si un sistema de IA médica apoya flujos de trabajo clínicos, diagnóstico, tratamiento o funciones reguladas de producto sanitario, puede activar obligaciones de alto riesgo relacionadas con documentación, supervisión, monitorización y gestión del riesgo.

Eso crea una posición difícil para cualquier proveedor de IA clínica alojado en Estados Unidos que atienda a clientes sanitarios de la UE.

- No basta con decir: "Estamos certificados en SOC 2".
- No basta con decir: "Cumplimos HIPAA".
- No basta con decir: "Tenemos un logo de GDPR en el Trust Center".

**Mi opinión es que la retirada probablemente no fue causada solo por este problema concreto.**

OpenEvidence no ha explicado públicamente el motivo completo de su retirada de la UE/Reino Unido. Sin embargo, podría estar relacionado con este complejo marco de control que la UE impone sobre las transferencias de datos sanitarios. Así que esta parte es mi suposición, no un hecho confirmado.

OpenEvidence es un producto de IA clínica, no un chatbot genérico.

- Su valor depende de la recuperación de información, la fundamentación en evidencia médica, las citas y la confianza en el flujo de trabajo.
- Su infraestructura parece incluir proveedores externos de infraestructura de IA.
- Los datos sanitarios de la UE requieren una base estricta bajo el artículo 9, garantías del encargado del tratamiento y controles de transferencia.
- El Reglamento de IA añade otra capa de incertidumbre en torno a la clasificación, las obligaciones de proveedor y desplegador, la documentación y la gestión del riesgo.
- Y si un proveedor central de infraestructura de IA no está cubierto de forma independiente por el DPF, entonces OpenEvidence tendría que demostrar una cadena alternativa de transferencia y subencargados del tratamiento para el procesamiento de datos sanitarios de la UE.

Esto no demuestra que Baseten causara la retirada. Tampoco demuestra que ninguna de las partes infringiera el RGPD.

Pero sí ofrece una explicación plausible de por qué una empresa sofisticada, bien financiada y aparentemente consciente del cumplimiento normativo podría decidir pausar el acceso en la UE y el Reino Unido en lugar de operar en una zona gris.

> En sanidad, "probablemente cumple" no es suficiente.

La retirada de OpenEvidence de la UE/Reino Unido no debería leerse como "la IA médica no puede funcionar en Europa".

Debería leerse así: la IA médica debe desplegarse con soberanía, auditabilidad y arquitectura regulatoria desde el primer día.

La IA sanitaria está pasando de la experimentación a la infraestructura. En esa fase, los ganadores no serán solo los equipos con las mejores demostraciones de modelos. Los ganadores serán los equipos capaces de responder a preguntas de compras, legales, seguridad clínica, protección de datos e infraestructura con evidencia.

## OpenEvidence no es magia: es arquitectura

Hay otra parte de esta historia que importa para los proveedores sanitarios europeos.

A menudo se habla de OpenEvidence como si fuera un avance propietario y misterioso de IA. Pero, según la información pública, su arquitectura parece seguir un patrón conocido:

- Un gran modelo de lenguaje, LLM.
- Una capa de recuperación médica, RAG.
- Fuentes RAG: PubMed, fuentes de evidencia clínica, incluido contenido licenciado o de socios como NEJM, JAMA, NCCN y Cochrane.
- Fundamentación mediante citas.
- Búsqueda y clasificación.

![Posible infraestructura soberana de IA médica tipo OpenEvidence](~/assets/images/openevidence-possible-architecture-es.png)

<p class="text-center text-sm font-medium">Posible infraestructura.</p>

Eso es potente, pero no es imposible de reproducir en una arquitectura soberana.

OpenEvidence no es simplemente un chatbot.

Es más bien un sistema sanitario real a escala completa: fuentes médicas fiables, calidad de recuperación, ajuste del modelo, experiencia de usuario, gobernanza y distribución.

Para hospitales, clínicas, aseguradoras, equipos farmacéuticos y proveedores tecnológicos sanitarios europeos, esa distinción importa.

Si la versión SaaS en nube pública de un asistente de IA clínica se vuelve difícil de utilizar por el RGPD, los subencargados del tratamiento, la incertidumbre del Reglamento de IA o la inferencia transfronteriza, la respuesta no es abandonar la IA médica.

## Un sistema tipo OpenEvidence *on-premise* y soberano es viable.

Futurion Solutions calcula, proporciona e instala hardware de servidor con GPU NVIDIA de alta gama en vuestra clínica y despliega sobre él un sistema de IA médica tipo OpenEvidence, completamente *on-premise* o híbrido con AWS European Sovereign Cloud.

La arquitectura es sencilla en principio:

- Desplegar MedGemma u otro LLM médico abierto o de pesos abiertos en las instalaciones del cliente o dentro de un entorno de nube europeo controlado.
- Ajustar el modelo con los datos clínicos, operativos, de pagadores, rutas asistenciales o institucionales aprobados por el cliente, cuando sea legalmente apropiado.
- Añadir generación aumentada por recuperación sobre la propia base documental del cliente: guías, protocolos, formularios, procedimientos normalizados de trabajo, normas de pagadores, referencias farmacológicas, rutas clínicas, políticas médicas y literatura aprobada.
- Mantener *embeddings*, *prompts*, salidas, registros de auditoría y estado del flujo de trabajo clínico bajo la gobernanza del cliente.
- Integrarse con los sistemas sanitarios existentes en lugar de sustituirlos.
- Dar soporte a estándares como FHIR, openEHR, flujos de trabajo ICD-10 y paquetes de exportación estructurados.
- Añadir revisión humana, pistas de auditoría, acceso basado en roles, citas de evidencia y monitorización desde el inicio.

Esto no es simplemente una versión más barata de un producto SaaS estadounidense.

Puede encajar mejor en la sanidad europea porque el modelo, los datos, la capa de recuperación, la evidencia de cumplimiento y el perímetro de despliegue están controlados por la organización sanitaria.

Los LLM de dominio general se entrenan de forma amplia. Son útiles, pero no son sistemas médicos por defecto.

Un modelo de dominio médico como MedGemma, u otro modelo abierto cuidadosamente seleccionado, combinado con ajuste fino y RAG privado sobre los propios datos aprobados de la organización, puede producir un sistema mucho más relevante para la realidad clínica y administrativa de esa organización que un LLM generalista respondiendo desde una memoria a escala de internet.

El objetivo no es copiar la marca OpenEvidence.

El objetivo es reproducir el patrón útil: IA médica fundamentada en evidencia, bajo el propio modelo de cumplimiento, infraestructura y gobernanza del cliente.
