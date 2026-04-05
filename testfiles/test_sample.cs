using UnityEngine;

namespace MyGame
{
    class playerController : MonoBehaviour
    {
        public float speed;
        public int Health;
        float jumpHeight = 3.5f;
        string playerName;
        
        void Update()
        {
            float MoveSpeed = speed * 45.0f;
            transform.position += Vector3.forward * MoveSpeed;
        }
        
        void OnEnable()
        {
            int X = 0;
        }
    }
}
