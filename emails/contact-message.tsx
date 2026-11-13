import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface ContactMessageEmailProps {
  name: string;
  email: string;
  message: string;
}

// Mismos valores que los tokens de app/globals.css; en un correo no hay variables CSS.
const C = {
  bg: "#0a0a0f",
  panel: "#0f0f18",
  ink: "#e6e9ff",
  dim: "#8a8fb5",
  cyan: "#00f5ff",
  line: "#1f2a35",
};

const MONO = "'Courier New', Courier, monospace";

/**
 * Correo que recibe el equipo por cada mensaje del formulario de /acerca-de.
 * Todo el contenido del usuario se interpola como texto: React lo escapa y nunca se renderiza como HTML.
 */
export function ContactMessageEmail({ name, email, message }: ContactMessageEmailProps) {
  const lines = message.split(/\r?\n/);

  return (
    <Html lang="es">
      <Head />
      <Preview>{`Mensaje de ${name} desde Arcade Vault`}</Preview>
      <Body style={{ backgroundColor: C.bg, margin: 0, padding: "32px 0", fontFamily: MONO }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: C.panel, border: `1px solid ${C.line}`, padding: 28 }}>
          <Heading
            as="h1"
            style={{ color: C.cyan, fontSize: 20, letterSpacing: "0.12em", margin: "0 0 4px", fontFamily: MONO }}
          >
            ARCADE VAULT
          </Heading>
          <Text style={{ color: C.dim, fontSize: 12, letterSpacing: "0.16em", margin: "0 0 20px" }}>
            NUEVO MENSAJE DE CONTACTO
          </Text>

          <Section>
            <Text style={label}>NOMBRE</Text>
            <Text style={value}>{name}</Text>
            <Text style={label}>CORREO ELECTRÓNICO</Text>
            <Text style={value}>
              <Link href={`mailto:${email}`} style={{ color: C.cyan }}>
                {email}
              </Link>
            </Text>
          </Section>

          <Hr style={{ borderColor: C.line, margin: "20px 0" }} />

          <Text style={label}>MENSAJE</Text>
          <Text style={{ ...value, lineHeight: "22px" }}>
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </Text>

          <Hr style={{ borderColor: C.line, margin: "20px 0" }} />
          <Text style={{ color: C.dim, fontSize: 11, margin: 0 }}>
            Responde a este correo para contestar directamente a {name}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const label = { color: C.dim, fontSize: 11, letterSpacing: "0.16em", margin: "12px 0 4px" };
const value = { color: C.ink, fontSize: 14, margin: 0, wordBreak: "break-word" as const };

export default ContactMessageEmail;
