import Button from 'react-bootstrap/Button';

function IButton(props) {
  return (
    <Button variant={props.variant} onClick={() => props.onClick()}>
      <div className="d-flex align-items-center">
        <props.icon className="me-1" /><span>{props.text}</span>
      </div>
    </Button>
  );
}

export default IButton;
