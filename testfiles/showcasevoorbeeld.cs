using UnityEngine;

public class dingetje : MonoBehaviour
{
    public float snelheidDing = 5;
    public GameObject datding;
    public int teller = 0;
    public bool ja = false;
    float x;
    float y;
    float z;
    string a = "hoi";
    Rigidbody rb;
    Transform ditgeval;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
        ditgeval = transform;
        x = 1;
        y = 2;
        z = 3;

        if (datding != null)
        {
            datding.transform.position = new Vector3(1, 2, 3);
        }

        print(a + teller);
    }

    void Update()
    {
        if (Input.GetKey(KeyCode.W))
        {
            ditgeval.position = ditgeval.position + new Vector3(0, 0, snelheidDing * Time.deltaTime);
            teller = teller + 1;
        }

        if (Input.GetKey(KeyCode.S))
        {
            ditgeval.position = ditgeval.position - new Vector3(0, 0, snelheidDing * Time.deltaTime);
            teller = teller - 1;
        }

        if (Input.GetKey(KeyCode.A))
        {
            transform.Translate(-1 * snelheidDing * Time.deltaTime, 0, 0);
        }

        if (Input.GetKey(KeyCode.D))
        {
            transform.Translate(1 * snelheidDing * Time.deltaTime, 0, 0);
        }

        if (teller > 100)
        {
            ja = true;
        }
        else
        {
            ja = false;
        }

        if (ja == true)
        {
            x = x + Time.deltaTime;
            y = y + x;
            z = y + x + z;

            if (rb != null)
            {
                rb.velocity = new Vector3(x, y, z);
            }
        }

        if (Input.GetKeyDown(KeyCode.Space))
        {
            DoeIets();
        }
    }

    void DoeIets()
    {
        GameObject g = GameObject.Find("Cube");

        if (g != null)
        {
            g.transform.localScale = new Vector3(Random.Range(1, 5), Random.Range(1, 5), Random.Range(1, 5));
        }

        if (datding != null)
        {
            datding.SetActive(!datding.activeSelf);
        }

        print("ding gedaan " + teller + " " + ja + " " + x + y + z);
    }

    void OnCollisionEnter(Collision botsing)
    {
        if (botsing.gameObject.tag == "Enemy")
        {
            snelheidDing = snelheidDing + 2;
            teller = 0;
        }
        else
        {
            snelheidDing = snelheidDing - 0.1f;
        }

        if (snelheidDing < 0)
        {
            snelheidDing = 0;
        }
    }
}